import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Head from 'next/head'

export default function ProjetoDetalhe() {
  const router = useRouter()
  const { id } = router.query
  const [projeto, setProjeto] = useState(null)
  const [tarefas, setTarefas] = useState([])
  const [equipe, setEquipe] = useState([])
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

    // Buscar etapas padrão para saber a ordem correta
    const { data: etapas } = await supabase
      .from('etapas_padrao')
      .select('*')
      .order('ordem', { ascending: true })

    // Buscar tarefas do projeto
    const { data: tarefasData } = await supabase
      .from('tarefas')
      .select('*')
      .eq('projeto_id', id)

    // Criar um mapa de ordem das etapas
    const ordemMap = {}
    etapas?.forEach(etapa => {
      ordemMap[etapa.id] = etapa.ordem
    })

    // Ordenar as tarefas pela ordem das etapas
    const tarefasOrdenadas = tarefasData?.sort((a, b) => {
      const ordemA = ordemMap[a.etapa_padrao_id] || 999
      const ordemB = ordemMap[b.etapa_padrao_id] || 999
      return ordemA - ordemB
    }) || []

    setTarefas(tarefasOrdenadas)

    const { data: equipeData } = await supabase
      .from('equipe')
      .select('*')
      .eq('ativo', true)
    
    setEquipe(equipeData || [])
    setLoading(false)
  }

  async function atualizarResponsavel(tarefaId, responsavel) {
    await supabase
      .from('tarefas')
      .update({ responsavel })
      .eq('id', tarefaId)
    carregarDados()
  }

  async function atualizarStatus(tarefaId, novoStatus) {
    await supabase
      .from('tarefas')
      .update({ status: novoStatus })
      .eq('id', tarefaId)
    carregarDados()
  }

  const tarefasEletrica = tarefas.filter(t => t.setor === 'eletrica')
  const tarefasMecanica = tarefas.filter(t => t.setor === 'mecanica')
  const tarefasAmbos = tarefas.filter(t => t.setor === 'ambos')

  if (loading) {
    return <div style={{ background: '#0a1423', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d5a80' }}>Carregando...</div>
  }

  return (
    <>
      <Head>
        <title>New Tech · {projeto?.nome}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&display=swap" rel="stylesheet"/>
      </Head>

      <div style={{ background: '#0a1423', minHeight: '100vh', fontFamily: "'Barlow Condensed', sans-serif", padding: '24px' }}>
        
        <button onClick={() => router.push('/projetos')} style={{ background: 'none', border: 'none', color: '#3d5a80', fontSize: '16px', cursor: 'pointer', marginBottom: '20px' }}>
          ← Voltar
        </button>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#f59e0b', fontSize: '32px', marginBottom: '8px' }}>{projeto?.nome}</h1>
          <div style={{ display: 'flex', gap: '20px', color: '#94a3b8' }}>
            {projeto?.numero_pedido && <span>📦 PO: {projeto.numero_pedido}</span>}
            {projeto?.cliente && <span>🏢 Cliente: {projeto.cliente}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
          
          {/* Geral */}
          <div>
            <h2 style={{ color: '#f59e0b', marginBottom: '16px' }}>📋 Geral ({tarefasAmbos.length})</h2>
            {tarefasAmbos.map(tarefa => (
              <div key={tarefa.id} style={{ background: 'rgba(22,35,58,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '4px solid #f59e0b', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <strong style={{ color: '#fff' }}>{tarefa.titulo}</strong>
                <select value={tarefa.responsavel || ''} onChange={e => atualizarResponsavel(tarefa.id, e.target.value)} style={{ width: '100%', marginTop: '10px', padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}>
                  <option value="">Responsável...</option>
                  {equipe.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Elétrica */}
          <div>
            <h2 style={{ color: '#3b82f6', marginBottom: '16px' }}>⚡ Elétrica ({tarefasEletrica.length})</h2>
            {tarefasEletrica.map(tarefa => (
              <div key={tarefa.id} style={{ background: 'rgba(22,35,58,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '4px solid #3b82f6', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <strong style={{ color: '#fff' }}>{tarefa.titulo}</strong>
                <select value={tarefa.responsavel || ''} onChange={e => atualizarResponsavel(tarefa.id, e.target.value)} style={{ width: '100%', marginTop: '10px', padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}>
                  <option value="">Responsável...</option>
                  {equipe.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Mecânica */}
          <div>
            <h2 style={{ color: '#10b981', marginBottom: '16px' }}>🔧 Mecânica ({tarefasMecanica.length})</h2>
            {tarefasMecanica.map(tarefa => (
              <div key={tarefa.id} style={{ background: 'rgba(22,35,58,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: '4px solid #10b981', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                <strong style={{ color: '#fff' }}>{tarefa.titulo}</strong>
                <select value={tarefa.responsavel || ''} onChange={e => atualizarResponsavel(tarefa.id, e.target.value)} style={{ width: '100%', marginTop: '10px', padding: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff' }}>
                  <option value="">Responsável...</option>
                  {equipe.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                </select>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  )
}
