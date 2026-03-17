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
  const [user, setUser] = useState(null)
  const [tempoAtivo, setTempoAtivo] = useState(null)
  const [tempoDisplay, setTempoDisplay] = useState({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user)
      }
    })
  }, [])

  useEffect(() => {
    if (id) {
      carregarDados()
    }
  }, [id])

  useEffect(() => {
    let interval
    if (tempoAtivo) {
      interval = setInterval(() => {
        setTempoDisplay(prev => ({
          ...prev,
          [tempoAtivo.tarefa_id]: (prev[tempoAtivo.tarefa_id] || 0) + 1
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [tempoAtivo])

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

    const { data: equipeData } = await supabase
      .from('equipe')
      .select('*')
      .eq('ativo', true)
    setEquipe(equipeData || [])

    // Carregar tempos salvos
    for (const tarefa of tarefasData || []) {
      const { data: apontamentos } = await supabase
        .from('apontamentos_tempo')
        .select('*')
        .eq('tarefa_id', tarefa.id)
        .eq('status', 'finalizado')

      const total = apontamentos?.reduce((acc, a) => acc + (a.tempo_segundos || 0), 0) || 0
      setTempoDisplay(prev => ({ ...prev, [tarefa.id]: total }))

      // Verificar se tem tempo ativo
      const { data: ativo } = await supabase
        .from('apontamentos_tempo')
        .select('*')
        .eq('tarefa_id', tarefa.id)
        .eq('status', 'executando')
        .maybeSingle()

      if (ativo) {
        const inicio = new Date(ativo.data_inicio)
        const passado = Math.floor((new Date() - inicio) / 1000)
        setTempoAtivo(ativo)
        setTempoDisplay(prev => ({ ...prev, [tarefa.id]: total + passado }))
      }
    }

    setLoading(false)
  }

  async function iniciarTempo(tarefaId) {
    if (!user) return

    // Se já tem um tempo ativo, pausa ele
    if (tempoAtivo) {
      await pausarTempo(tempoAtivo.tarefa_id)
    }

    const { data, error } = await supabase
      .from('apontamentos_tempo')
      .insert([{
        tarefa_id: tarefaId,
        usuario_id: user.id,
        data_inicio: new Date(),
        status: 'executando',
        tempo_segundos: 0
      }])
      .select()
      .single()

    if (!error) {
      setTempoAtivo(data)
    }
  }

  async function pausarTempo(tarefaId) {
    if (!tempoAtivo || tempoAtivo.tarefa_id !== tarefaId) return

    const tempoAtual = tempoDisplay[tarefaId] || 0

    await supabase
      .from('apontamentos_tempo')
      .update({
        data_fim: new Date(),
        tempo_segundos: tempoAtual,
        status: 'pausado'
      })
      .eq('id', tempoAtivo.id)

    setTempoAtivo(null)
  }

  async function finalizarTempo(tarefaId) {
    if (!tempoAtivo || tempoAtivo.tarefa_id !== tarefaId) return

    const tempoAtual = tempoDisplay[tarefaId] || 0

    await supabase
      .from('apontamentos_tempo')
      .update({
        data_fim: new Date(),
        tempo_segundos: tempoAtual,
        status: 'finalizado'
      })
      .eq('id', tempoAtivo.id)

    setTempoAtivo(null)
    carregarDados() // Recarrega tudo para atualizar os totais
  }

  function formatarTempo(segundos) {
    if (segundos < 0) return '00:00:00'
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
  }

  async function atualizarTarefa(tarefaId, campo, valor) {
    await supabase
      .from('tarefas')
      .update({ [campo]: valor })
      .eq('id', tarefaId)
    
    setTarefas(prev => prev.map(t => 
      t.id === tarefaId ? { ...t, [campo]: valor } : t
    ))
  }

  if (loading) {
    return <div style={{ background: '#0a1423', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Carregando...</div>
  }

  const tarefasPorSetor = {
    eletrica: tarefas.filter(t => t.setor === 'eletrica'),
    mecanica: tarefas.filter(t => t.setor === 'mecanica'),
    ambos: tarefas.filter(t => t.setor === 'ambos')
  }

  const TaskCard = ({ tarefa }) => {
    const tempoAtual = tempoDisplay[tarefa.id] || 0
    const isAtivo = tempoAtivo?.tarefa_id === tarefa.id
    const responsaveis = tarefa.responsaveis ? tarefa.responsaveis.split(',').filter(r => r.trim()) : []
    const [mostrarSeletor, setMostrarSeletor] = useState(false)

    return (
      <div style={{
        background: '#1a2635',
        border: '1px solid #2a3745',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px'
      }}>
        <h3 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '16px' }}>{tarefa.titulo}</h3>
        
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
          {projeto.numero_pedido && <div>📦 PO: {projeto.numero_pedido}</div>}
          {projeto.cliente && <div>🏢 Cliente: {projeto.cliente}</div>}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <select
            value={tarefa.prioridade || 'Normal'}
            onChange={(e) => atualizarTarefa(tarefa.id, 'prioridade', e.target.value)}
            style={{ padding: '4px', background: '#2a3745', color: '#fff', border: '1px solid #3a4755', borderRadius: '4px' }}
          >
            <option>Normal</option>
            <option>Alta</option>
            <option>Urgente</option>
          </select>

          <select
            value={tarefa.status || 'Pendente'}
            onChange={(e) => atualizarTarefa(tarefa.id, 'status', e.target.value)}
            style={{ padding: '4px', background: '#2a3745', color: '#fff', border: '1px solid #3a4755', borderRadius: '4px' }}
          >
            <option>Pendente</option>
            <option>Em andamento</option>
            <option>Aguardando</option>
            <option>Concluida</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Responsáveis:</span>
            <button
              onClick={() => setMostrarSeletor(!mostrarSeletor)}
              style={{ background: 'none', border: '1px dashed #888', color: '#888', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
            >
              + Adicionar
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {responsaveis.map(resp => (
              <span key={resp} style={{ background: '#2a3745', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                {resp}
              </span>
            ))}
          </div>

          {mostrarSeletor && (
            <select
              onChange={async (e) => {
                if (e.target.value) {
                  const novos = [...responsaveis, e.target.value]
                  await atualizarTarefa(tarefa.id, 'responsaveis', novos.join(','))
                  setMostrarSeletor(false)
                }
              }}
              style={{ width: '100%', marginTop: '8px', padding: '4px', background: '#2a3745', color: '#fff', border: '1px solid #3a4755', borderRadius: '4px' }}
            >
              <option value="">Selecionar...</option>
              {equipe.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
            </select>
          )}
        </div>

        <div style={{ background: '#0f1a24', padding: '12px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#f59e0b', fontSize: '20px', fontWeight: 'bold' }}>
              {formatarTempo(tempoAtual)}
            </span>
            <span style={{ color: isAtivo ? '#22c55e' : '#888', fontSize: '12px' }}>
              {isAtivo ? '▶️ Em andamento' : '⏹️ Parado'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!isAtivo && (
              <button
                onClick={() => iniciarTempo(tarefa.id)}
                style={{ flex: 1, background: '#22c55e', border: 'none', padding: '8px', borderRadius: '4px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ▶️ Iniciar
              </button>
            )}
            {isAtivo && (
              <button
                onClick={() => pausarTempo(tarefa.id)}
                style={{ flex: 1, background: '#f59e0b', border: 'none', padding: '8px', borderRadius: '4px', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ⏸️ Pausar
              </button>
            )}
            {isAtivo && (
              <button
                onClick={() => finalizarTempo(tarefa.id)}
                style={{ flex: 1, background: '#3b82f6', border: 'none', padding: '8px', borderRadius: '4px', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
              >
                ✅ Finalizar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>New Tech · {projeto?.nome}</title>
      </Head>
      <div style={{ background: '#0a1423', minHeight: '100vh', padding: '20px' }}>
        <button onClick={() => router.push('/projetos')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: '20px', cursor: 'pointer' }}>
          ← Voltar
        </button>

        <h1 style={{ color: '#f59e0b', marginBottom: '20px' }}>{projeto?.nome}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div>
            <h2 style={{ color: '#f59e0b' }}>📋 Geral ({tarefasPorSetor.ambos.length})</h2>
            {tarefasPorSetor.ambos.map(t => <TaskCard key={t.id} tarefa={t} />)}
          </div>
          <div>
            <h2 style={{ color: '#3b82f6' }}>⚡ Elétrica ({tarefasPorSetor.eletrica.length})</h2>
            {tarefasPorSetor.eletrica.map(t => <TaskCard key={t.id} tarefa={t} />)}
          </div>
          <div>
            <h2 style={{ color: '#10b981' }}>🔧 Mecânica ({tarefasPorSetor.mecanica.length})</h2>
            {tarefasPorSetor.mecanica.map(t => <TaskCard key={t.id} tarefa={t} />)}
          </div>
        </div>
      </div>
    </>
  )
}
