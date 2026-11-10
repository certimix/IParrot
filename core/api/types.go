package api

import (
	"strings"

	"google.golang.org/protobuf/proto"

	"berty.tech/berty/v2/go/pkg/messengertypes"
)

// Os tipos abaixo são o "contrato" JSON entre o núcleo Go e a interface.
// Eles espelham ui/src/core/types.ts — mude os dois juntos.

type Account struct {
	PublicKey   string `json:"publicKey"`
	DisplayName string `json:"displayName"`
	Link        string `json:"link"`
}

type Contact struct {
	PublicKey             string `json:"publicKey"`
	ConversationPublicKey string `json:"conversationPublicKey"`
	DisplayName           string `json:"displayName"`
	// State: IncomingRequest | OutgoingRequestEnqueued | OutgoingRequestSent | Accepted | Undefined
	State       string `json:"state"`
	CreatedDate int64  `json:"createdDate"`
	SentDate    int64  `json:"sentDate"`
}

type Conversation struct {
	PublicKey string `json:"publicKey"`
	// Type: AccountType | ContactType | MultiMemberType | Undefined
	Type                   string `json:"type"`
	DisplayName            string `json:"displayName"`
	Link                   string `json:"link"`
	UnreadCount            int32  `json:"unreadCount"`
	LastUpdate             int64  `json:"lastUpdate"`
	CreatedDate            int64  `json:"createdDate"`
	ContactPublicKey       string `json:"contactPublicKey"`
	AccountMemberPublicKey string `json:"accountMemberPublicKey"`
	IsOpen                 bool   `json:"isOpen"`
	// MutedUntil em milissegundos; 0 = não silenciada. O Berty usa um valor
	// bem no futuro para "silenciada para sempre".
	MutedUntil int64 `json:"mutedUntil"`
}

type Member struct {
	PublicKey             string `json:"publicKey"`
	ConversationPublicKey string `json:"conversationPublicKey"`
	DisplayName           string `json:"displayName"`
	IsMe                  bool   `json:"isMe"`
	IsCreator             bool   `json:"isCreator"`
}

type Interaction struct {
	CID string `json:"cid"`
	// Type: TypeUserMessage | TypeGroupInvitation | TypeSetGroupInfo | TypeSetUserInfo | TypeAcknowledge | ...
	Type                  string `json:"type"`
	ConversationPublicKey string `json:"conversationPublicKey"`
	MemberPublicKey       string `json:"memberPublicKey"`
	IsMine                bool   `json:"isMine"`
	Acknowledged          bool   `json:"acknowledged"`
	SentDate              int64  `json:"sentDate"`
	TargetCID             string `json:"targetCid,omitempty"`
	// Text é o corpo de uma TypeUserMessage.
	Text string `json:"text,omitempty"`
	// InvitationLink é o link de uma TypeGroupInvitation (já com o prefixo IParrot).
	InvitationLink string `json:"invitationLink,omitempty"`
	// DisplayName vem em TypeSetGroupInfo / TypeSetUserInfo.
	DisplayName string `json:"displayName,omitempty"`
}

type Notification struct {
	Kind  string `json:"kind"`
	Title string `json:"title"`
	Body  string `json:"body"`
}

// Event é o que trafega em GET /api/v1/events (Server-Sent Events).
type Event struct {
	// Type: listEnded | account | contact | conversation | conversationDeleted | member |
	//       interaction | interactionDeleted | history | notification
	Type  string `json:"type"`
	IsNew bool   `json:"isNew"`

	Account      *Account      `json:"account,omitempty"`
	Contact      *Contact      `json:"contact,omitempty"`
	Conversation *Conversation `json:"conversation,omitempty"`
	Member       *Member       `json:"member,omitempty"`
	Interaction  *Interaction  `json:"interaction,omitempty"`
	// Interactions vem em "history" (resposta a /conversations/load).
	Interactions []*Interaction `json:"interactions,omitempty"`
	// PublicKey / CID identificam o que foi removido nos eventos *Deleted,
	// e a conversa em "history".
	PublicKey    string        `json:"publicKey,omitempty"`
	CID          string        `json:"cid,omitempty"`
	Notification *Notification `json:"notification,omitempty"`
}

// --- links -----------------------------------------------------------------

const (
	bertyInternalPrefix   = "BERTY://"
	iparrotInternalPrefix = "IPARROT://"
)

// toIParrotLink troca o prefixo interno do Berty pelo do IParrot.
// O conteúdo do link é idêntico, então os dois apps continuam compatíveis.
func toIParrotLink(link string) string {
	if hasPrefixFold(link, bertyInternalPrefix) {
		return iparrotInternalPrefix + link[len(bertyInternalPrefix):]
	}
	return link
}

// toBertyLink aceita links IParrot (iparrot://...) e devolve no formato que o
// serviço de mensagens entende. Links do Berty passam sem alteração.
func toBertyLink(link string) string {
	link = strings.TrimSpace(link)
	if hasPrefixFold(link, iparrotInternalPrefix) {
		return bertyInternalPrefix + link[len(iparrotInternalPrefix):]
	}
	return link
}

func hasPrefixFold(s, prefix string) bool {
	return len(s) >= len(prefix) && strings.EqualFold(s[:len(prefix)], prefix)
}

// --- conversões protobuf -> JSON --------------------------------------------

func accountDTO(a *messengertypes.Account) *Account {
	if a == nil {
		return nil
	}
	return &Account{
		PublicKey:   a.GetPublicKey(),
		DisplayName: a.GetDisplayName(),
		Link:        toIParrotLink(a.GetLink()),
	}
}

func contactDTO(c *messengertypes.Contact) *Contact {
	if c == nil {
		return nil
	}
	return &Contact{
		PublicKey:             c.GetPublicKey(),
		ConversationPublicKey: c.GetConversationPublicKey(),
		DisplayName:           c.GetDisplayName(),
		State:                 c.GetState().String(),
		CreatedDate:           c.GetCreatedDate(),
		SentDate:              c.GetSentDate(),
	}
}

func conversationDTO(c *messengertypes.Conversation) *Conversation {
	if c == nil {
		return nil
	}
	return &Conversation{
		PublicKey:              c.GetPublicKey(),
		Type:                   c.GetType().String(),
		DisplayName:            c.GetDisplayName(),
		Link:                   toIParrotLink(c.GetLink()),
		UnreadCount:            c.GetUnreadCount(),
		LastUpdate:             c.GetLastUpdate(),
		CreatedDate:            c.GetCreatedDate(),
		ContactPublicKey:       c.GetContactPublicKey(),
		AccountMemberPublicKey: c.GetAccountMemberPublicKey(),
		IsOpen:                 c.GetIsOpen(),
		MutedUntil:             c.GetMutedUntil(),
	}
}

func memberDTO(m *messengertypes.Member) *Member {
	if m == nil {
		return nil
	}
	return &Member{
		PublicKey:             m.GetPublicKey(),
		ConversationPublicKey: m.GetConversationPublicKey(),
		DisplayName:           m.GetDisplayName(),
		IsMe:                  m.GetIsMe(),
		IsCreator:             m.GetIsCreator(),
	}
}

func interactionDTO(i *messengertypes.Interaction) *Interaction {
	if i == nil {
		return nil
	}
	out := &Interaction{
		CID:                   i.GetCid(),
		Type:                  i.GetType().String(),
		ConversationPublicKey: i.GetConversationPublicKey(),
		MemberPublicKey:       i.GetMemberPublicKey(),
		IsMine:                i.GetIsMine(),
		Acknowledged:          i.GetAcknowledged(),
		SentDate:              i.GetSentDate(),
		TargetCID:             i.GetTargetCid(),
	}

	// O payload é um protobuf cujo tipo depende de Type; erros aqui só deixam
	// os campos de conteúdo vazios.
	if payload, err := i.UnmarshalPayload(); err == nil {
		switch p := payload.(type) {
		case *messengertypes.AppMessage_UserMessage:
			out.Text = p.GetBody()
		case *messengertypes.AppMessage_GroupInvitation:
			out.InvitationLink = toIParrotLink(p.GetLink())
		case *messengertypes.AppMessage_SetGroupInfo:
			out.DisplayName = p.GetDisplayName()
		case *messengertypes.AppMessage_SetUserInfo:
			out.DisplayName = p.GetDisplayName()
		}
	}
	return out
}

// eventDTO converte um StreamEvent do mensageiro. O segundo retorno é false
// para eventos que a interface não usa (dispositivos, status de pares, tokens).
func eventDTO(ev *messengertypes.StreamEvent) (*Event, bool) {
	if ev == nil {
		return nil, false
	}

	// TypeConversationPartialLoad não é tratado por StreamEvent.UnmarshalPayload.
	if ev.GetType() == messengertypes.StreamEvent_TypeConversationPartialLoad {
		var p messengertypes.StreamEvent_ConversationPartialLoad
		if err := proto.Unmarshal(ev.GetPayload(), &p); err != nil {
			return nil, false
		}
		out := &Event{Type: "history", IsNew: ev.GetIsNew(), PublicKey: p.GetConversationPk()}
		for _, i := range p.GetInteractions() {
			out.Interactions = append(out.Interactions, interactionDTO(i))
		}
		return out, true
	}

	payload, err := ev.UnmarshalPayload()
	if err != nil {
		return nil, false
	}

	out := &Event{IsNew: ev.GetIsNew()}
	switch p := payload.(type) {
	case *messengertypes.StreamEvent_ListEnded:
		out.Type = "listEnded"
	case *messengertypes.StreamEvent_AccountUpdated:
		out.Type = "account"
		out.Account = accountDTO(p.GetAccount())
	case *messengertypes.StreamEvent_ContactUpdated:
		out.Type = "contact"
		out.Contact = contactDTO(p.GetContact())
	case *messengertypes.StreamEvent_ConversationUpdated:
		out.Type = "conversation"
		out.Conversation = conversationDTO(p.GetConversation())
	case *messengertypes.StreamEvent_ConversationDeleted:
		out.Type = "conversationDeleted"
		out.PublicKey = p.GetPublicKey()
	case *messengertypes.StreamEvent_MemberUpdated:
		out.Type = "member"
		out.Member = memberDTO(p.GetMember())
	case *messengertypes.StreamEvent_InteractionUpdated:
		out.Type = "interaction"
		out.Interaction = interactionDTO(p.GetInteraction())
	case *messengertypes.StreamEvent_InteractionDeleted:
		out.Type = "interactionDeleted"
		out.CID = p.GetCid()
		out.PublicKey = p.GetConversationPublicKey()
	case *messengertypes.StreamEvent_Notified:
		out.Type = "notification"
		out.Notification = &Notification{
			Kind:  p.GetType().String(),
			Title: p.GetTitle(),
			Body:  p.GetBody(),
		}
	default:
		return nil, false
	}
	return out, true
}
