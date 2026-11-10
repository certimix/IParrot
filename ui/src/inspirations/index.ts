// Projetos que inspiraram o IParrot e as respectivas licenças.
// Os textos em ./texts são cópias fiéis dos arquivos de licença de cada repositório.

export interface LicenseDoc {
	label: string
	/** Nome do arquivo em ./texts */
	file: string
}

export interface Inspiration {
	id: string
	name: string
	repo: string
	license: string
	holder: string
	/** O que é o projeto. */
	about: string
	/** Como ele entra no IParrot. */
	role: string
	/** true = o código faz parte do aplicativo; false = serviu de estudo/referência. */
	bundled: boolean
	docs: LicenseDoc[]
}

export const inspirations: Inspiration[] = [
	{
		id: 'berty',
		name: 'Berty',
		repo: 'https://github.com/berty/berty',
		license: 'Apache-2.0 ou MIT',
		holder: '© 2018–2023 Berty Technologies e colaboradores',
		about: 'Mensageiro aberto, ponto a ponto, que funciona com ou sem internet e sem servidor central.',
		role: 'É a referência principal. O IParrot usa a camada de mensagens do Berty (contatos, conversas, grupos e histórico) e segue a mesma arquitetura: núcleo em Go e interface separada.',
		bundled: true,
		docs: [
			{ label: 'Aviso de direitos autorais', file: 'berty-COPYRIGHT.txt' },
			{ label: 'Licença MIT', file: 'berty-MIT.txt' },
			{ label: 'Licença Apache 2.0', file: 'berty-APACHE.txt' },
		],
	},
	{
		id: 'weshnet',
		name: 'Wesh Network (weshnet)',
		repo: 'https://github.com/berty/weshnet',
		license: 'Apache-2.0 ou MIT',
		holder: '© 2018–2023 Berty Technologies e colaboradores',
		about: 'O protocolo Wesh: identidade, pedidos de contato, grupos e criptografia ponta a ponta sobre IPFS e libp2p.',
		role: 'É o motor de rede e de criptografia do IParrot. Toda mensagem trafega pelo protocolo Wesh.',
		bundled: true,
		docs: [
			{ label: 'Aviso de direitos autorais', file: 'weshnet-COPYRIGHT.txt' },
			{ label: 'Licença MIT', file: 'weshnet-MIT.txt' },
			{ label: 'Licença Apache 2.0', file: 'weshnet-APACHE.txt' },
		],
	},
	{
		id: 'go-orbit-db',
		name: 'go-orbit-db',
		repo: 'https://github.com/berty/go-orbit-db',
		license: 'Apache-2.0',
		holder: 'Berty Technologies; portado do OrbitDB (MIT, Protocol Labs e Haja Networks)',
		about: 'Banco de dados distribuído, sem servidor, que sincroniza entre os participantes.',
		role: 'Guarda o histórico de cada conversa e grupo e o mantém sincronizado entre os aparelhos.',
		bundled: true,
		docs: [
			{ label: 'Licença Apache 2.0', file: 'go-orbit-db-LICENSE.txt' },
			{ label: 'Atribuições (OrbitDB e bibliotecas relacionadas)', file: 'go-orbit-db-ATTRIBUTIONS.txt' },
		],
	},
	{
		id: 'go-ipfs-log',
		name: 'go-ipfs-log',
		repo: 'https://github.com/berty/go-ipfs-log',
		license: 'Apache-2.0',
		holder: 'Berty Technologies; portado do ipfs-log (MIT, Protocol Labs e Haja Networks)',
		about: 'Registro CRDT somente-acréscimo sobre IPFS: cada participante acrescenta entradas e todos chegam ao mesmo resultado.',
		role: 'É a estrutura por baixo do go-orbit-db; garante que mensagens enviadas offline se encaixem na ordem certa depois.',
		bundled: true,
		docs: [{ label: 'Licença Apache 2.0 e aviso do ipfs-log', file: 'go-ipfs-log-LICENSE.txt' }],
	},
	{
		id: 'go-ipfs-repo-encrypted',
		name: 'go-ipfs-repo-encrypted',
		repo: 'https://github.com/berty/go-ipfs-repo-encrypted',
		license: 'Apache-2.0 ou MIT',
		holder: '© 2020 Berty Technologies e colaboradores',
		about: 'Repositório IPFS gravado em SQLCipher, ou seja, criptografado em disco.',
		role: 'Guarda no aparelho, de forma criptografada, a identidade e os dados do nó do IParrot.',
		bundled: true,
		docs: [
			{ label: 'Aviso de direitos autorais', file: 'go-ipfs-repo-encrypted-COPYRIGHT.txt' },
			{ label: 'Licença MIT', file: 'go-ipfs-repo-encrypted-MIT.txt' },
			{ label: 'Licença Apache 2.0', file: 'go-ipfs-repo-encrypted-APACHE.txt' },
		],
	},
	{
		id: 'gorm-sqlite',
		name: 'GORM SQLite / SQLCipher driver',
		repo: 'https://github.com/go-gorm/sqlite',
		license: 'MIT',
		holder: '© 2013–presente Jinzhu',
		about: 'Driver do GORM para SQLite, na variante SQLCipher mantida dentro do repositório do Berty.',
		role: 'Copiado para core/gormsqlcipher: é com ele que o banco de mensagens do IParrot é aberto criptografado.',
		bundled: true,
		docs: [{ label: 'Licença MIT', file: 'gorm-sqlite-MIT.txt' }],
	},
	{
		id: 'rea',
		name: 'REA — Reverse Engineer Anything',
		repo: 'https://github.com/morluto/rea',
		license: 'MIT',
		holder: '© 2026 morluto',
		about: 'Ferramenta para um agente de IA investigar como um aplicativo funciona e registrar as evidências do que encontrou.',
		role: 'Deu o método de estudo: observar, separar o que é fato do que é inferência e só então construir. Nenhum código do REA faz parte do aplicativo.',
		bundled: false,
		docs: [{ label: 'Licença MIT', file: 'rea-MIT.txt' }],
	},
	{
		id: 'gno',
		name: 'Gno (fork do Berty)',
		repo: 'https://github.com/berty/gno',
		license: 'GNO Network GPL 3.0 (gnovm, gno.land); Apache-2.0 (tm2)',
		holder: '© 2022 New Tendermint, LLC e colaboradores',
		about: 'Máquina virtual e blockchain que executam contratos escritos em Go.',
		role: 'Estudado como referência de aplicativos descentralizados. Nenhum código do Gno faz parte do IParrot — a licença do gnovm é copyleft e exigiria abrir o aplicativo nos mesmos termos.',
		bundled: false,
		docs: [
			{ label: 'Resumo das licenças por pasta', file: 'gno-LICENSE.txt' },
			{ label: 'GNO Network General Public License (gnovm e gno.land)', file: 'gno-gnovm-LICENSE.txt' },
			{ label: 'Licença Apache 2.0 (tm2)', file: 'gno-tm2-LICENSE.txt' },
		],
	},
	{
		id: 'uptime',
		name: 'Berty Uptime (Upptime)',
		repo: 'https://github.com/berty/uptime',
		license: 'MIT',
		holder: '© 2020 Anand Chowdhary',
		about: 'Página de status e monitor de disponibilidade mantidos só com um repositório do GitHub.',
		role: 'Referência para a futura página de status dos servidores de apoio do IParrot. Nenhum código faz parte do aplicativo.',
		bundled: false,
		docs: [{ label: 'Licença MIT', file: 'uptime-MIT.txt' }],
	},
	{
		id: 'www-berty-tech',
		name: 'Site berty.tech',
		repo: 'https://github.com/berty/www.berty.tech',
		license: 'MIT',
		holder: '© 2018–2020 Berty Technologies',
		about: 'O site institucional e a documentação do Berty e do protocolo Wesh.',
		role: 'Fonte da documentação do protocolo e referência para o futuro site do IParrot. Nenhum código faz parte do aplicativo.',
		bundled: false,
		docs: [{ label: 'Licença MIT', file: 'www-berty-tech-MIT.txt' }],
	},
]

const loaders = import.meta.glob<string>('./texts/*.txt', { query: '?raw', import: 'default' })

/** Carrega o texto integral de uma licença. */
export async function loadLicenseText(file: string): Promise<string> {
	const loader = loaders[`./texts/${file}`]
	if (!loader) throw new Error(`Arquivo de licença não encontrado: ${file}`)
	return loader()
}
