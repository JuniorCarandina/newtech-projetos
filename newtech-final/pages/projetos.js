import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Projetos() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [projetos, setProjetos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [novoProjeto, setNovoProjeto] = useState({
    nome: '',
    numero_pedido: '',
    cliente: '',
    descricao: ''
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else {
        setUser(data.session.user)
        carregarProjetos()
      }
    })
  }, [])

  async function carregarProjetos() {
    setLoading(true)
    const { data } = await supabase
      .from('projetos')
      .select('*')
      .order('criado_em', { ascending: false })
    setProjetos(data || [])
    setLoading(false)
  }

  async function criarProjeto(e) {
    e.preventDefault()
    if (!novoProjeto.nome) return

    const { data, error } = await supabase
      .from('projetos')
      .insert([{
        ...novoProjeto,
        criado_por: user.id,
        status: 'ativo'
      }])
      .select()

    if (!error && data) {
      const { data: etapas } = await supabase
        .from('etapas_padrao')
        .select('*')
        .order('ordem')

      if (etapas) {
        const tarefasIniciais = etapas.map(etapa => ({
          projeto_id: data[0].id,
          etapa_padrao_id: etapa.id,
          titulo: etapa.nome,
          status: 'Pendente',
          setor: etapa.setor,
          prazo: new Date(Date.now() + etapa.dias_estimados * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }))
        
        await supabase.from('tarefas').insert(tarefasIniciais)
      }
      
      setModalAberto(false)
      setNovoProjeto({ nome: '', numero_pedido: '', cliente: '', descricao: '' })
      carregarProjetos()
    }
  }

  if (!user) return null

  return (
    <>
      <Head>
        <title>New Tech · Projetos</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{
        background: '#0a1423',
        minHeight: '100vh',
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{ color: '#f59e0b', fontSize: '32px', margin: 0 }}>PROJETOS</h1>
            <p style={{ color: '#3d5a80', margin: 0 }}>Gerencie todos os projetos</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '10px 20px',
                color: '#e2e8f0',
                cursor: 'pointer'
              }}
            >
              ← Voltar
            </button>
            <button
              onClick={() => setModalAberto(true)}
              style={{
                background: '#f59e0b',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                color: '#000',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              + Novo Projeto
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#3d5a80' }}>
            Carregando...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {projetos.map(projeto => (
              <div
                key={projeto.id}
                onClick={() => router.push(`/projeto/${projeto.id}`)}
                style={{
                  background: 'rgba(22,35,58,0.9)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px',
                  padding: '20px',
                  cursor: 'pointer'
                }}
              >
                <h3 style={{ color: '#f59e0b', margin: '0 0 10px 0' }}>{projeto.nome}</h3>
                {projeto.numero_pedido && (
                  <div style={{ color: '#3d5a80', fontSize: '14px' }}>PO: {projeto.numero_pedido}</div>
                )}
                {projeto.cliente && (
                  <div style={{ color: '#94a3b8', fontSize: '14px' }}>Cliente: {projeto.cliente}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {modalAberto && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: '#0c1a2e',
              borderRadius: '12px',
              padding: '32px',
              width: '500px',
              maxWidth: '90%'
            }}>
              <h2 style={{ color: '#f59e0b', marginBottom: '24px' }}>Novo Projeto</h2>
              <form onSubmit={criarProjeto}>
                <input
                  type="text"
                  placeholder="Nome do Projeto *"
                  value={novoProjeto.nome}
                  onChange={e => setNovoProjeto({...novoProjeto, nome: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginBottom: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                  required
                />
                <input
                  type="text"
                  placeholder="Número do Pedido/PO"
                  value={novoProjeto.numero_pedido}
                  onChange={e => setNovoProjeto({...novoProjeto, numero_pedido: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginBottom: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
                <input
                  type="text"
                  placeholder="Cliente"
                  value={novoProjeto.cliente}
                  onChange={e => setNovoProjeto({...novoProjeto, cliente: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    marginBottom: '24px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setModalAberto(false)}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      padding: '10px 20px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: '#f59e0b',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '10px 24px',
                      color: '#000',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Criar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
