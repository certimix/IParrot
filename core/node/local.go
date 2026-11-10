package node

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

// LocalState guarda o que é decisão do usuário neste aparelho e o Berty não
// controla: conversas ocultas e contatos bloqueados.
//
// Existe porque a camada de mensagens do Berty não processa os eventos
// AccountContactBlocked nem AccountGroupLeft do protocolo Wesh — depois de
// bloquear ou sair de um grupo, o banco dele continuaria listando a conversa.
// O IParrot chama o protocolo (a ação é real e vale para todos os aparelhos)
// e registra aqui o que deve sumir desta instalação.
//
// Fica em texto puro, fora do banco criptografado, e por isso guarda apenas
// chaves públicas — que já circulam pela rede — e nenhum conteúdo de mensagem.
type LocalState struct {
	path string

	mu     sync.RWMutex
	data   localData
	broken bool // erro de gravação já avisado, para não repetir no log
}

type localData struct {
	Version int `json:"version"`
	// Hidden: conversas que não devem mais aparecer (grupo deixado, conversa apagada).
	Hidden map[string]bool `json:"hidden"`
	// Blocked: contatos bloqueados, por chave pública.
	Blocked map[string]bool `json:"blocked"`
	// Rdvp e Relays: servidores próprios, no lugar dos públicos do weshnet.
	// Só têm efeito ao iniciar o nó, por isso trocar exige reabrir o app.
	Rdvp   []string `json:"rdvp,omitempty"`
	Relays []string `json:"relays,omitempty"`
}

// LoadLocalState lê (ou cria) `local.json` dentro de dir.
func LoadLocalState(dir string) (*LocalState, error) {
	s := &LocalState{
		path: filepath.Join(dir, "local.json"),
		data: localData{Version: 1, Hidden: map[string]bool{}, Blocked: map[string]bool{}},
	}

	raw, err := os.ReadFile(s.path)
	switch {
	case err == nil:
		if err := json.Unmarshal(raw, &s.data); err != nil {
			return nil, errors.New("local.json corrompido: apague o arquivo para recomeçar")
		}
		if s.data.Hidden == nil {
			s.data.Hidden = map[string]bool{}
		}
		if s.data.Blocked == nil {
			s.data.Blocked = map[string]bool{}
		}
	case errors.Is(err, os.ErrNotExist):
		// Primeira execução: o arquivo nasce na primeira alteração.
	default:
		return nil, err
	}
	return s, nil
}

// IsHidden diz se a conversa foi ocultada neste aparelho.
func (s *LocalState) IsHidden(conversationPK string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.Hidden[conversationPK]
}

// IsBlocked diz se o contato foi bloqueado.
func (s *LocalState) IsBlocked(contactPK string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.data.Blocked[contactPK]
}

// Hide oculta (ou volta a mostrar) uma conversa.
func (s *LocalState) Hide(conversationPK string, hidden bool) error {
	return s.set(func(d *localData) {
		if hidden {
			d.Hidden[conversationPK] = true
		} else {
			delete(d.Hidden, conversationPK)
		}
	})
}

// Block marca (ou desmarca) um contato como bloqueado.
func (s *LocalState) Block(contactPK string, blocked bool) error {
	return s.set(func(d *localData) {
		if blocked {
			d.Blocked[contactPK] = true
		} else {
			delete(d.Blocked, contactPK)
		}
	})
}

// Servers devolve os servidores de encontro e de relay configurados.
func (s *LocalState) Servers() (rdvp, relays []string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]string(nil), s.data.Rdvp...), append([]string(nil), s.data.Relays...)
}

// SetServers grava os servidores. Vale a partir da próxima abertura do app.
func (s *LocalState) SetServers(rdvp, relays []string) error {
	return s.set(func(d *localData) {
		d.Rdvp = rdvp
		d.Relays = relays
	})
}

// Blocked devolve a lista de contatos bloqueados.
func (s *LocalState) Blocked() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]string, 0, len(s.data.Blocked))
	for pk := range s.data.Blocked {
		out = append(out, pk)
	}
	return out
}

func (s *LocalState) set(change func(*localData)) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	change(&s.data)

	out, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	// Grava em arquivo temporário e troca, para não perder o estado se o app cair no meio.
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, out, 0o600); err != nil {
		s.broken = true
		return err
	}
	if err := os.Rename(tmp, s.path); err != nil {
		s.broken = true
		_ = os.Remove(tmp)
		return err
	}
	s.broken = false
	return nil
}
