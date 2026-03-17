import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

export default function ProjetoDetalhe() {
  const router = useRouter()
  const { id } = router.query
  const [projeto, setProjeto] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      carregarDados()
    }
  }, [id])

  async function carregarDados() {
    setLoading(true)
    
    const { data: projetoData } = await supabase
      .from('projetos')
      .select('*')
      .eq('id', id)
      .single()
    
    setProjeto(projetoData)

    const { data: tarefasData } = await supabase
      .from('tarefas')
      .select('*')
      .eq('projeto_id', id)
      .order('etapa_padrao_id')
    
    setTarefas(tarefasData || [])
    setLoading(false)
  }

  async function atualizarStatus(tarefaId, novoStatus) {
    await supabase
      .from('tarefas')
      .update({ status: novoStatus })
      .eq('id', tarefaId)
    
    carregarDados()
  }

  if (loading) {
    return (
      <div style={{
        background: '#0a1423',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#3d5a80'
      }}>
        Carregando...
      </div>
    )
  }

  if (!projeto) {
    return (
      <div style={{
        background: '#0a1423',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444'
      }}>
        Projeto não encontrado
      </div>
    )
  }

  const tarefasEletrica = tarefas.filter(t => t.setor === 'eletrica' || t.setor === 'ambos')
  const tarefasMecanica = tarefas.filter(t => t.setor === 'mecanica' || t.setor === 'ambos')

  return (
    <>
      <Head>
        <title>New Tech · {projeto.nome}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{
        background: '#0a1423',
        minHeight: '100vh',
        fontFamily: "'Barlow Condensed', sans-serif",
        padding: '24px'
      }}>
        <button
          onClick={() => router.push('/projetos')}
          style={{
            background: 'none',
            border: 'none',
            color: '#3d5a80',
            fontSize: '16px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          ← Voltar para Projetos
        </button>

        <h1 style={{ color: '#f59e0b', fontSize: '32px', marginBottom: '8px' }}>{projeto.nome}</h1>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px', color: '#94a3b8' }}>
          {projeto.numero_pedido && <span>PO: {projeto.numero_pedido}</span>}
          {projeto.cliente && <span>Cliente: {projeto.cliente}</span>}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '24px' 
        }}>
          {/* Coluna Elétrica */}
          <div>
            <h2 style={{ color: '#3b82f6', marginBottom: '16px' }}>⚡ Elétrica</h2>
            {tarefasEletrica.map(tarefa => (
              <div key={tarefa.id} style={{
                background: 'rgba(22,35,58,0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#fff' }}>{tarefa.titulo}</strong>
                  <select
                    value={tarefa.status}
                    onChange={(e) => atualizarStatus(tarefa.id, e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#fff'
                    }}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluida">Concluída</option>
                  </select>
                </div>
                {tarefa.prazo && (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    Prazo: {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Coluna Mecânica */}
          <div>
            <h2 style={{ color: '#10b981', marginBottom: '16px' }}>🔧 Mecânica</h2>
            {tarefasMecanica.map(tarefa => (
              <div key={tarefa.id} style={{
                background: 'rgba(22,35,58,0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ color: '#fff' }}>{tarefa.titulo}</strong>
                  <select
                    value={tarefa.status}
                    onChange={(e) => atualizarStatus(tarefa.id, e.target.value)}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#fff'
                    }}
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Concluida">Concluída</option>
                  </select>
                </div>
                {tarefa.prazo && (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    Prazo: {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
