package api

import "testing"

func TestLinkPrefixRoundTrip(t *testing.T) {
	berty := "BERTY://PB/ABC-123"
	ip := toIParrotLink(berty)
	if ip != "IPARROT://PB/ABC-123" {
		t.Fatalf("toIParrotLink devolveu %q", ip)
	}
	if back := toBertyLink(ip); back != berty {
		t.Fatalf("toBertyLink devolveu %q, esperado %q", back, berty)
	}
	// minúsculas (como o usuário costuma colar) e espaços sobrando
	if back := toBertyLink("  iparrot://PB/ABC-123  "); back != berty {
		t.Fatalf("link minúsculo virou %q", back)
	}
	// links do Berty e web passam intactos
	for _, in := range []string{"BERTY://PB/XYZ", "https://berty.tech/id#key=abc"} {
		if out := toBertyLink(in); out != in {
			t.Fatalf("%q foi alterado para %q", in, out)
		}
	}
}

func TestCleanName(t *testing.T) {
	cases := map[string]struct {
		want string
		ok   bool
	}{
		"  Márcio  José ": {"Márcio José", true},
		"Ana\tBeatriz":    {"Ana Beatriz", true},
		"   ":             {"", false},
		"":                {"", false},
	}
	for in, exp := range cases {
		got, ok := cleanName(in)
		if ok != exp.ok || got != exp.want {
			t.Fatalf("cleanName(%q) = %q,%v; esperado %q,%v", in, got, ok, exp.want, exp.ok)
		}
	}
	long := make([]rune, maxNameRunes+1)
	for i := range long {
		long[i] = 'a'
	}
	if _, ok := cleanName(string(long)); ok {
		t.Fatal("nome longo demais deveria ser recusado")
	}
}

func TestIsLoopbackHost(t *testing.T) {
	ok := []string{"127.0.0.1:7788", "127.0.0.1", "localhost:5173", "localhost", "[::1]:7788", "::1", "127.3.2.1:80"}
	for _, h := range ok {
		if !isLoopbackHost(h) {
			t.Fatalf("%q deveria ser aceito", h)
		}
	}
	// DNS rebinding e acesso externo precisam ser recusados
	bad := []string{"iparrot.attacker.com", "192.168.0.14:7788", "10.0.0.1", "0.0.0.0:7788", "evil.localhost.attacker.com", "[2001:db8::1]:7788"}
	for _, h := range bad {
		if isLoopbackHost(h) {
			t.Fatalf("%q deveria ser recusado", h)
		}
	}
}
