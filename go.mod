module iparrot

go 1.26.5

// As versões abaixo espelham o go.mod do Berty v2.472.0, que é a base do núcleo.
// Rode `make deps` (go mod tidy) para resolver as dependências indiretas e gerar o go.sum.
require (
	berty.tech/berty/v2 v2.472.0
	berty.tech/go-ipfs-repo-encrypted v1.3.1-0.20260601130618-6d410a1fc4a3
	berty.tech/weshnet/v2 v2.3.1-0.20260605081032-915f5df54716
	github.com/ipfs/go-datastore v0.9.1
	github.com/ipfs/kubo v0.41.0
	github.com/mutecomm/go-sqlcipher/v4 v4.4.2
	github.com/wailsapp/wails/v2 v2.17.1
	go.uber.org/zap v1.28.0
	golang.org/x/mobile v0.0.0-20231127183840-76ac6878050a
	google.golang.org/protobuf v1.36.11
	gorm.io/gorm v1.25.0
	moul.io/zapgorm2 v1.1.1
)

// Mesmas substituições usadas pelo Berty (necessárias para iOS, Android SDK 30+ e SQLCipher).
replace (
	bazil.org/fuse => bazil.org/fuse v0.0.0-20200117225306-7b5117fecadc
	github.com/multiformats/go-multiaddr => github.com/d4ryl00/go-multiaddr v0.0.0-20260530213151-544411990008
	github.com/mutecomm/go-sqlcipher/v4 => github.com/berty/go-sqlcipher/v4 v4.4.3-0.20220810151512-74ea78235b48
	github.com/peterbourgon/ff/v3 => github.com/moul/ff/v3 v3.0.1
	golang.org/x/mobile => github.com/berty/mobile v0.0.8
)
