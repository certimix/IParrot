// Package api expõe o nó IParrot para a interface por HTTP local.
//
// O servidor escuta apenas em loopback (127.0.0.1) e toda chamada precisa do
// token gerado a cada inicialização. A interface (React) é a mesma em todas as
// plataformas; o que muda é só quem sobe este servidor: o app desktop (Wails),
// o app móvel (gomobile) ou o daemon iparrotd.
package api

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"go.uber.org/zap"
	"google.golang.org/protobuf/proto"

	"berty.tech/berty/v2/go/pkg/messengertypes"
	"berty.tech/weshnet/v2/pkg/protocoltypes"

	"iparrot/core/node"
)

// Version é a versão do núcleo IParrot.
const Version = "0.1.0"

const (
	maxBodyBytes      = 1 << 20 // 1 MiB por requisição
	maxMessageRunes   = 16000
	maxNameRunes      = 64
	defaultHistory    = 30
	rpcTimeout        = 60 * time.Second
	exportTimeout     = 10 * time.Minute
	keepAliveInterval = 20 * time.Second
)

// Options configura o servidor.
type Options struct {
	Logger *zap.Logger
	// Token de acesso. Vazio = gera um aleatório.
	Token string
	// Static, se informado, é servido em "/" (a interface compilada).
	Static fs.FS
}

// Server é o servidor HTTP local.
type Server struct {
	node   *node.Node
	logger *zap.Logger
	token  string
	static fs.FS
	start  time.Time
}

// New cria o servidor para um nó já iniciado.
func New(n *node.Node, opts Options) (*Server, error) {
	if n == nil {
		return nil, errors.New("nó não iniciado")
	}
	if opts.Logger == nil {
		opts.Logger = zap.NewNop()
	}
	if opts.Token == "" {
		b := make([]byte, 24)
		if _, err := rand.Read(b); err != nil {
			return nil, fmt.Errorf("falha ao gerar token: %w", err)
		}
		opts.Token = hex.EncodeToString(b)
	}
	return &Server{node: n, logger: opts.Logger, token: opts.Token, static: opts.Static, start: time.Now()}, nil
}

// Token devolve o token que a interface deve enviar.
func (s *Server) Token() string { return s.token }

// Listen abre a porta em loopback. addr vazio = 127.0.0.1 em porta livre.
func Listen(addr string) (net.Listener, error) {
	if addr == "" {
		addr = "127.0.0.1:0"
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, fmt.Errorf("endereço inválido %q: %w", addr, err)
	}
	if ip := net.ParseIP(host); host != "localhost" && (ip == nil || !ip.IsLoopback()) {
		return nil, fmt.Errorf("o núcleo só aceita endereços de loopback, recebido %q", host)
	}
	return net.Listen("tcp", addr)
}

// Serve atende até o listener ser fechado ou ctx ser cancelado.
func (s *Server) Serve(ctx context.Context, l net.Listener) error {
	srv := &http.Server{
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	if err := srv.Serve(l); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// Handler monta as rotas.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/status", s.handleStatus)
	mux.HandleFunc("GET /api/v1/account", s.handleAccountGet)
	mux.HandleFunc("POST /api/v1/account", s.handleAccountUpdate)
	mux.HandleFunc("GET /api/v1/share", s.handleShare)
	mux.HandleFunc("POST /api/v1/links/parse", s.handleLinkParse)
	mux.HandleFunc("POST /api/v1/contacts/request", s.handleContactRequest)
	mux.HandleFunc("POST /api/v1/contacts/accept", s.handleContactAccept)
	mux.HandleFunc("POST /api/v1/groups", s.handleGroupCreate)
	mux.HandleFunc("POST /api/v1/groups/join", s.handleGroupJoin)
	mux.HandleFunc("POST /api/v1/groups/link", s.handleGroupLink)
	mux.HandleFunc("POST /api/v1/conversations/mute", s.handleConversationMute)
	mux.HandleFunc("POST /api/v1/conversations/hide", s.handleConversationHide)
	mux.HandleFunc("POST /api/v1/groups/leave", s.handleGroupLeave)
	mux.HandleFunc("POST /api/v1/contacts/block", s.handleContactBlock)
	mux.HandleFunc("POST /api/v1/conversations/open", s.handleConversationOpen)
	mux.HandleFunc("POST /api/v1/conversations/close", s.handleConversationClose)
	mux.HandleFunc("POST /api/v1/conversations/load", s.handleConversationLoad)
	mux.HandleFunc("POST /api/v1/messages", s.handleMessageSend)
	mux.HandleFunc("GET /api/v1/search", s.handleSearch)
	mux.HandleFunc("GET /api/v1/blocked", s.handleBlockedList)
	mux.HandleFunc("GET /api/v1/network", s.handleNetwork)
	mux.HandleFunc("GET /api/v1/servers", s.handleServersGet)
	mux.HandleFunc("POST /api/v1/servers", s.handleServersSet)
	mux.HandleFunc("POST /api/v1/export", s.handleExport)
	mux.HandleFunc("GET /api/v1/events", s.handleEvents)

	if s.static != nil {
		mux.Handle("/", http.FileServerFS(s.static))
	}

	return s.guard(mux)
}

// guard aplica as proteções comuns: Host de loopback (contra DNS rebinding),
// CORS para os WebViews e token obrigatório em /api/.
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackHost(r.Host) {
			http.Error(w, "host não permitido", http.StatusForbidden)
			return
		}

		// A interface roda em origens diferentes conforme a plataforma
		// (wails://, http://wails.localhost, capacitor://localhost, https://localhost).
		// Como o acesso depende do token, a origem pode ser liberada.
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", "*")
		h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		h.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		h.Set("Access-Control-Max-Age", "600")
		h.Set("X-Content-Type-Options", "nosniff")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/api/") {
			if !s.authorized(r) {
				writeError(w, http.StatusUnauthorized, "token inválido ou ausente")
				return
			}
			h.Set("Cache-Control", "no-store")
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) authorized(r *http.Request) bool {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		// EventSource não permite cabeçalhos; aceita ?token= só para leitura.
		if r.Method == http.MethodGet {
			token = r.URL.Query().Get("token")
		}
	}
	return subtle.ConstantTimeCompare([]byte(token), []byte(s.token)) == 1
}

func isLoopbackHost(hostport string) bool {
	host := hostport
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		host = h
	}
	host = strings.Trim(host, "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// --- handlers -----------------------------------------------------------------

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{
		"name":     "IParrot",
		"version":  Version,
		"uptimeMs": time.Since(s.start).Milliseconds(),
	})
}

func (s *Server) handleAccountGet(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.AccountGet(ctx, &messengertypes.AccountGet_Request{})
	if err != nil {
		s.fail(w, "AccountGet", err)
		return
	}
	writeJSON(w, accountDTO(rep.GetAccount()))
}

func (s *Server) handleAccountUpdate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName string `json:"displayName"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	name, ok := cleanName(req.DisplayName)
	if !ok {
		writeError(w, http.StatusBadRequest, "nome inválido")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.AccountUpdate(ctx, &messengertypes.AccountUpdate_Request{DisplayName: name}); err != nil {
		s.fail(w, "AccountUpdate", err)
		return
	}
	rep, err := s.node.Messenger.AccountGet(ctx, &messengertypes.AccountGet_Request{})
	if err != nil {
		s.fail(w, "AccountGet", err)
		return
	}
	writeJSON(w, accountDTO(rep.GetAccount()))
}

// handleShare devolve o link de contato do usuário (o que vira QR Code).
func (s *Server) handleShare(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := rpcContext(r)
	defer cancel()

	acc, err := s.node.Messenger.AccountGet(ctx, &messengertypes.AccountGet_Request{})
	if err != nil {
		s.fail(w, "AccountGet", err)
		return
	}
	name := acc.GetAccount().GetDisplayName()

	rep, err := s.node.Messenger.InstanceShareableBertyID(ctx, &messengertypes.InstanceShareableBertyID_Request{
		Reset_:      r.URL.Query().Get("reset") == "1",
		DisplayName: name,
	})
	if err != nil {
		s.fail(w, "InstanceShareableBertyID", err)
		return
	}
	writeJSON(w, map[string]any{
		"link":        toIParrotLink(rep.GetInternalUrl()),
		"displayName": name,
	})
}

func (s *Server) handleLinkParse(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Link string `json:"link"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.ParseDeepLink(ctx, &messengertypes.ParseDeepLink_Request{Link: toBertyLink(req.Link)})
	if err != nil {
		writeError(w, http.StatusBadRequest, "link não reconhecido")
		return
	}

	link := rep.GetLink()
	out := map[string]any{"kind": "unknown", "displayName": ""}
	switch link.GetKind() {
	case messengertypes.BertyLink_ContactInviteV1Kind:
		out["kind"] = "contact"
		out["displayName"] = link.GetBertyId().GetDisplayName()
	case messengertypes.BertyLink_GroupV1Kind:
		out["kind"] = "group"
		out["displayName"] = link.GetBertyGroup().GetDisplayName()
	}
	writeJSON(w, out)
}

func (s *Server) handleContactRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Link string `json:"link"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Link) == "" {
		writeError(w, http.StatusBadRequest, "link vazio")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.ContactRequest(ctx, &messengertypes.ContactRequest_Request{Link: toBertyLink(req.Link)}); err != nil {
		s.fail(w, "ContactRequest", err)
		return
	}
	writeOK(w)
}

func (s *Server) handleContactAccept(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.ContactAccept(ctx, &messengertypes.ContactAccept_Request{PublicKey: req.PublicKey}); err != nil {
		s.fail(w, "ContactAccept", err)
		return
	}
	writeOK(w)
}

func (s *Server) handleGroupCreate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName string   `json:"displayName"`
		Contacts    []string `json:"contacts"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	name, ok := cleanName(req.DisplayName)
	if !ok {
		writeError(w, http.StatusBadRequest, "nome do grupo inválido")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.ConversationCreate(ctx, &messengertypes.ConversationCreate_Request{
		DisplayName:      name,
		ContactsToInvite: req.Contacts,
	})
	if err != nil {
		s.fail(w, "ConversationCreate", err)
		return
	}
	writeJSON(w, map[string]any{"publicKey": rep.GetPublicKey()})
}

func (s *Server) handleGroupJoin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Link string `json:"link"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.ConversationJoin(ctx, &messengertypes.ConversationJoin_Request{Link: toBertyLink(req.Link)}); err != nil {
		s.fail(w, "ConversationJoin", err)
		return
	}
	writeOK(w)
}

// handleGroupLink gera o link de convite de um grupo.
func (s *Server) handleGroupLink(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey   string `json:"publicKey"`
		DisplayName string `json:"displayName"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	pk, err := decodeKey(req.PublicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "chave do grupo inválida")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.ShareableBertyGroup(ctx, &messengertypes.ShareableBertyGroup_Request{
		GroupPk:   pk,
		GroupName: req.DisplayName,
	})
	if err != nil {
		s.fail(w, "ShareableBertyGroup", err)
		return
	}
	writeJSON(w, map[string]any{"link": toIParrotLink(rep.GetInternalUrl())})
}

// handleConversationMute silencia ou volta a notificar uma conversa.
func (s *Server) handleConversationMute(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
		Muted     bool   `json:"muted"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	_, err := s.node.Messenger.ConversationMute(ctx, &messengertypes.ConversationMute_Request{
		GroupPk:     req.PublicKey,
		Unmute:      !req.Muted,
		MuteForever: req.Muted,
	})
	if err != nil {
		s.fail(w, "ConversationMute", err)
		return
	}
	writeOK(w)
}

// handleConversationHide tira a conversa da lista deste aparelho.
//
// As mensagens continuam no banco local: o Berty não tem apagar conversa, e
// inventar uma exclusão que não apaga nada seria enganoso. A interface diz
// isso ao usuário.
func (s *Server) handleConversationHide(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
		Hidden    bool   `json:"hidden"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if req.PublicKey == "" {
		writeError(w, http.StatusBadRequest, "conversa não informada")
		return
	}

	if err := s.node.Local.Hide(req.PublicKey, req.Hidden); err != nil {
		s.fail(w, "ocultar conversa", err)
		return
	}
	writeOK(w)
}

// handleGroupLeave sai de um grupo de verdade (protocolo Wesh) e o esconde aqui.
func (s *Server) handleGroupLeave(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	pk, err := decodeKey(req.PublicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "chave do grupo inválida")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Protocol.MultiMemberGroupLeave(ctx, &protocoltypes.MultiMemberGroupLeave_Request{GroupPk: pk}); err != nil {
		s.fail(w, "MultiMemberGroupLeave", err)
		return
	}
	// A camada de mensagens do Berty não acompanha a saída, então o grupo
	// precisa ser escondido aqui para não ficar como conversa morta na lista.
	if err := s.node.Local.Hide(req.PublicKey, true); err != nil {
		s.logger.Warn("saiu do grupo mas não foi possível escondê-lo", zap.Error(err))
	}
	writeOK(w)
}

// handleContactBlock bloqueia ou desbloqueia um contato.
func (s *Server) handleContactBlock(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
		// ConversationPublicKey é opcional: some junto com o contato.
		ConversationPublicKey string `json:"conversationPublicKey"`
		Blocked               bool   `json:"blocked"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	pk, err := decodeKey(req.PublicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "chave do contato inválida")
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if req.Blocked {
		_, err = s.node.Protocol.ContactBlock(ctx, &protocoltypes.ContactBlock_Request{ContactPk: pk})
	} else {
		_, err = s.node.Protocol.ContactUnblock(ctx, &protocoltypes.ContactUnblock_Request{ContactPk: pk})
	}
	if err != nil {
		s.fail(w, "ContactBlock", err)
		return
	}

	if err := s.node.Local.Block(req.PublicKey, req.Blocked); err != nil {
		s.logger.Warn("bloqueio aplicado no protocolo mas não registrado localmente", zap.Error(err))
	}
	if req.ConversationPublicKey != "" {
		if err := s.node.Local.Hide(req.ConversationPublicKey, req.Blocked); err != nil {
			s.logger.Warn("não foi possível esconder a conversa do contato bloqueado", zap.Error(err))
		}
	}
	writeOK(w)
}

func (s *Server) handleConversationOpen(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.ConversationOpen(ctx, &messengertypes.ConversationOpen_Request{GroupPk: req.PublicKey}); err != nil {
		s.fail(w, "ConversationOpen", err)
		return
	}
	writeOK(w)
}

func (s *Server) handleConversationClose(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	if _, err := s.node.Messenger.ConversationClose(ctx, &messengertypes.ConversationClose_Request{GroupPk: req.PublicKey}); err != nil {
		s.fail(w, "ConversationClose", err)
		return
	}
	writeOK(w)
}

// handleConversationLoad pede mensagens mais antigas; elas chegam pelo fluxo
// de eventos como um evento "history".
func (s *Server) handleConversationLoad(w http.ResponseWriter, r *http.Request) {
	var req struct {
		PublicKey string `json:"publicKey"`
		RefCID    string `json:"refCid"`
		Amount    int32  `json:"amount"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	if req.Amount <= 0 || req.Amount > 200 {
		req.Amount = defaultHistory
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	_, err := s.node.Messenger.ConversationLoad(ctx, &messengertypes.ConversationLoad_Request{
		Options: &messengertypes.PaginatedInteractionsOptions{
			Amount:         req.Amount,
			RefCid:         req.RefCID,
			ConversationPk: req.PublicKey,
		},
	})
	if err != nil {
		s.fail(w, "ConversationLoad", err)
		return
	}
	writeOK(w)
}

func (s *Server) handleMessageSend(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Conversation string `json:"conversation"`
		Text         string `json:"text"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	text := strings.TrimSpace(req.Text)
	if text == "" || len([]rune(text)) > maxMessageRunes {
		writeError(w, http.StatusBadRequest, "mensagem vazia ou longa demais")
		return
	}
	if req.Conversation == "" {
		writeError(w, http.StatusBadRequest, "conversa não informada")
		return
	}

	payload, err := proto.Marshal(&messengertypes.AppMessage_UserMessage{Body: text})
	if err != nil {
		s.fail(w, "marshal", err)
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.Interact(ctx, &messengertypes.Interact_Request{
		Type:                  messengertypes.AppMessage_TypeUserMessage,
		Payload:               payload,
		ConversationPublicKey: req.Conversation,
	})
	if err != nil {
		s.fail(w, "Interact", err)
		return
	}
	writeJSON(w, map[string]any{"cid": rep.GetCid()})
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	if query == "" {
		writeJSON(w, map[string]any{"results": []*Interaction{}})
		return
	}

	ctx, cancel := rpcContext(r)
	defer cancel()

	rep, err := s.node.Messenger.MessageSearch(ctx, &messengertypes.MessageSearch_Request{Query: query, Limit: 50})
	if err != nil {
		s.fail(w, "MessageSearch", err)
		return
	}
	results := make([]*Interaction, 0, len(rep.GetResults()))
	for _, i := range rep.GetResults() {
		results = append(results, interactionDTO(i))
	}
	writeJSON(w, map[string]any{"results": results})
}

// handleBlockedList lista os contatos bloqueados neste aparelho.
func (s *Server) handleBlockedList(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]any{"blocked": s.node.Local.Blocked()})
}

// handleNetwork resume o estado da rede P2P para a tela de configurações.
func (s *Server) handleNetwork(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := rpcContext(r)
	defer cancel()

	cfg, err := s.node.Protocol.ServiceGetConfiguration(ctx, &protocoltypes.ServiceGetConfiguration_Request{})
	if err != nil {
		s.fail(w, "ServiceGetConfiguration", err)
		return
	}

	out := map[string]any{
		"peerId":         cfg.GetPeerId(),
		"listeners":      cfg.GetListeners(),
		"connectedPeers": int64(0),
		"peers":          []map[string]any{},
		"goVersion":      "",
		"os":             "",
		"arch":           "",
	}

	// As duas chamadas abaixo são informativas: se falharem, a tela mostra o que tiver.
	if info, err := s.node.Protocol.SystemInfo(ctx, &protocoltypes.SystemInfo_Request{}); err == nil {
		out["connectedPeers"] = info.GetP2P().GetConnectedPeers()
		out["goVersion"] = info.GetProcess().GetGoVersion()
		out["os"] = info.GetProcess().GetOperatingSystem()
		out["arch"] = info.GetProcess().GetArch()
	} else {
		s.logger.Debug("SystemInfo falhou", zap.Error(err))
	}
	if list, err := s.node.Protocol.PeerList(ctx, &protocoltypes.PeerList_Request{}); err == nil {
		peers := make([]map[string]any, 0, len(list.GetPeers()))
		for _, p := range list.GetPeers() {
			features := make([]string, 0, len(p.GetFeatures()))
			for _, f := range p.GetFeatures() {
				features = append(features, f.String())
			}
			peers = append(peers, map[string]any{
				"id":         p.GetId(),
				"active":     p.GetIsActive(),
				"latencyMs":  p.GetMinLatency(),
				"features":   features,
				"routeCount": len(p.GetRoutes()),
			})
		}
		out["peers"] = peers
	} else {
		s.logger.Debug("PeerList falhou", zap.Error(err))
	}

	writeJSON(w, out)
}

// handleServersGet devolve os servidores de encontro e relay configurados.
func (s *Server) handleServersGet(w http.ResponseWriter, r *http.Request) {
	rdvp, relays := s.node.Local.Servers()
	writeJSON(w, map[string]any{
		// O que a pessoa gravou (vazio = não mexeu).
		"rdvp":   orEmpty(rdvp),
		"relays": orEmpty(relays),
		// O que o nó está realmente usando. Difere do acima quando o weshnet
		// caiu para os servidores públicos do Berty.
		"effectiveRdvp":   orEmpty(s.node.EffectiveRdvp),
		"effectiveRelays": orEmpty(s.node.EffectiveRelays),
		"usingDefaults":   s.node.UsingDefaultServers,
	})
}

// handleServersSet grava os servidores. Vale ao reabrir o app: trocar de
// servidor com o nó no ar derrubaria as conexões abertas.
func (s *Server) handleServersSet(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Rdvp   []string `json:"rdvp"`
		Relays []string `json:"relays"`
	}
	if !readJSON(w, r, &req) {
		return
	}

	rdvp, err := cleanMaddrs(req.Rdvp)
	if err != nil {
		writeError(w, http.StatusBadRequest, "endereço de encontro inválido: "+err.Error())
		return
	}
	relays, err := cleanMaddrs(req.Relays)
	if err != nil {
		writeError(w, http.StatusBadRequest, "endereço de relay inválido: "+err.Error())
		return
	}

	if err := s.node.Local.SetServers(rdvp, relays); err != nil {
		s.fail(w, "salvar servidores", err)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "restartRequired": true})
}

// handleExport grava um backup completo da conta num arquivo e devolve o
// caminho. O conteúdo não passa pela interface: é um tar grande e o WebView
// não é lugar para isso.
func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), exportTimeout)
	defer cancel()

	stream, err := s.node.Messenger.InstanceExportData(ctx, &messengertypes.InstanceExportData_Request{})
	if err != nil {
		s.fail(w, "InstanceExportData", err)
		return
	}

	dir := exportDir(s.node.DataDir())
	if err := os.MkdirAll(dir, 0o700); err != nil {
		s.fail(w, "criar pasta do backup", err)
		return
	}
	name := fmt.Sprintf("iparrot-backup-%s.tar", time.Now().Format("2006-01-02-1504"))
	path := filepath.Join(dir, name)

	file, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		s.fail(w, "criar arquivo do backup", err)
		return
	}

	var written int64
	for {
		chunk, recvErr := stream.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			file.Close()
			os.Remove(path)
			s.fail(w, "InstanceExportData", recvErr)
			return
		}
		n, writeErr := file.Write(chunk.GetExportedData())
		if writeErr != nil {
			file.Close()
			os.Remove(path)
			s.fail(w, "gravar o backup", writeErr)
			return
		}
		written += int64(n)
	}
	if err := file.Close(); err != nil {
		os.Remove(path)
		s.fail(w, "fechar o backup", err)
		return
	}

	s.logger.Info("backup da conta gravado", zap.String("path", path), zap.Int64("bytes", written))
	writeJSON(w, map[string]any{"path": path, "bytes": written})
}

// handleEvents é o fluxo em tempo real (Server-Sent Events).
//
// Primeiro chega o estado atual (conta, contatos, conversas, membros e as
// últimas `history` mensagens de cada conversa), depois um evento "listEnded",
// e daí em diante tudo que acontecer.
func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming não suportado")
		return
	}

	history := int32(defaultHistory)
	if v, err := strconv.Atoi(r.URL.Query().Get("history")); err == nil && v > 0 && v <= 500 {
		history = int32(v)
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	stream, err := s.node.Messenger.EventStream(ctx, &messengertypes.EventStream_Request{ShallowAmount: history})
	if err != nil {
		s.fail(w, "EventStream", err)
		return
	}

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, ": iparrot\n\n")
	flusher.Flush()

	events := make(chan *Event, 64)
	go func() {
		defer close(events)
		for {
			rep, err := stream.Recv()
			if err != nil {
				return
			}
			ev, ok := eventDTO(rep.GetEvent())
			if !ok || !s.visible(ev) {
				continue
			}
			select {
			case events <- ev:
			case <-ctx.Done():
				return
			}
		}
	}()

	ping := time.NewTicker(keepAliveInterval)
	defer ping.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ping.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case ev, open := <-events:
			if !open {
				return
			}
			data, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

// --- utilidades ---------------------------------------------------------------

// visible aplica as escolhas deste aparelho (conversas ocultas, contatos
// bloqueados) antes de o evento chegar à interface.
func (s *Server) visible(ev *Event) bool {
	local := s.node.Local
	if local == nil {
		return true
	}
	switch ev.Type {
	case "conversation":
		return !local.IsHidden(ev.Conversation.PublicKey)
	case "conversationDeleted":
		return !local.IsHidden(ev.PublicKey)
	case "contact":
		return !local.IsBlocked(ev.Contact.PublicKey)
	case "member":
		return !local.IsHidden(ev.Member.ConversationPublicKey)
	case "interaction":
		return !local.IsHidden(ev.Interaction.ConversationPublicKey)
	case "interactionDeleted", "history":
		return !local.IsHidden(ev.PublicKey)
	}
	return true
}

// decodeKey lê uma chave pública no formato que o Berty usa na interface:
// base64 URL-safe sem padding.
func decodeKey(s string) ([]byte, error) {
	key, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return nil, err
	}
	if len(key) == 0 {
		return nil, errors.New("chave vazia")
	}
	return key, nil
}

// exportDir escolhe onde gravar o backup: a pasta de downloads do usuário
// quando existe (desktop) e, no celular, a própria pasta de dados do app.
func exportDir(dataDir string) string {
	if dir := os.Getenv("IPARROT_EXPORT_DIR"); dir != "" {
		return dir
	}
	if home, err := os.UserHomeDir(); err == nil {
		for _, name := range []string{"Downloads", "Download"} {
			candidate := filepath.Join(home, name)
			if info, err := os.Stat(candidate); err == nil && info.IsDir() {
				return candidate
			}
		}
	}
	return filepath.Join(dataDir, "backups")
}

// cleanMaddrs valida endereços multiaddr sem trazer a biblioteca inteira: o
// weshnet faz a validação de verdade ao subir, aqui basta barrar o óbvio.
func cleanMaddrs(in []string) ([]string, error) {
	out := make([]string, 0, len(in))
	for _, raw := range in {
		v := strings.TrimSpace(raw)
		if v == "" {
			continue
		}
		if len(v) > 512 {
			return nil, errors.New("endereço longo demais")
		}
		if !strings.HasPrefix(v, "/") {
			return nil, fmt.Errorf("%q deveria começar com /, como /ip4/1.2.3.4/tcp/4040/p2p/12D3Koo…", v)
		}
		out = append(out, v)
	}
	if len(out) > 16 {
		return nil, errors.New("são no máximo 16 endereços")
	}
	return out, nil
}

func orEmpty(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}

func rpcContext(r *http.Request) (context.Context, context.CancelFunc) {
	return context.WithTimeout(r.Context(), rpcTimeout)
}

func cleanName(name string) (string, bool) {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" || len([]rune(name)) > maxNameRunes {
		return "", false
	}
	return name, true
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	body := http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(body)
	if err := dec.Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// A resposta já começou; não há como trocar o status.
		return
	}
}

func writeOK(w http.ResponseWriter) {
	writeJSON(w, map[string]any{"ok": true})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": msg})
}

// fail registra o erro completo no log e devolve uma mensagem curta à interface.
func (s *Server) fail(w http.ResponseWriter, op string, err error) {
	s.logger.Warn("chamada falhou", zap.String("op", op), zap.Error(err))
	status := http.StatusInternalServerError
	if errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusGatewayTimeout
	}
	writeError(w, status, fmt.Sprintf("%s: %v", op, err))
}
