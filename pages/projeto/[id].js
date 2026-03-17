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
  const [tempos, setTempos] = useState({})
  const [tempoInterval, setTempoInterval] = useState({})

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

  async function carregarDados() {
    setLoading(true)
    
    const { data: projetoData } = await supabase
      .from('projetos')
      .select('*')
      .eq('id', id)
      .single()
    
    setProjeto(projetoData)

    const { data: etapas } = await supabase
      .from('etapas_padrao')
      .select('*')
      .order('ordem', { ascending: true })

    const { data: tarefasData } = await supabase
      .from('tarefas')
      .select('*')
      .eq('projeto_id', id)

    // Criar mapa de ordem das etapas
    const ordemMap = {}
    etapas?.forEach(etapa => {
      ordemMap[etapa.id] = etapa.ordem
    })

    // Ordenar tarefas pela ordem das etapas
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

    // Carregar tempos de todas as tarefas
    for (const tarefa of tarefasOrdenadas) {
      await carregarTempoTarefa(tarefa.id)
    }

    setLoading(false)
  }

  async function carregarTempoTarefa(tarefaId) {
    // Buscar TODOS os apontamentos da tarefa
    const { data: apontamentos } = await supabase
      .from('apontamentos_tempo')
      .select('*')
      .eq('tarefa_id', tarefaId)
      .order('data_inicio', { ascending: false })

    if (!apontamentos || apontamentos.length === 0) {
      setTempos(prev => ({
        ...prev,
        [tarefaId]: { 
          tempoAtual: 0, 
          status: 'parado',
          apontamentos: []
        }
      }))
      return
    }

async function iniciarTempo(tarefaId) {
  if (!user) return

  // Verificar se já existe um tempo pausado para esta tarefa
  const { data: tempoPausado } = await supabase
    .from('apontamentos_tempo')
    .select('*')
    .eq('tarefa_id', tarefaId)
    .eq('status', 'pausado')
    .order('data_inicio', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (tempoPausado) {
    // Reativar o tempo pausado
    const { data, error } = await supabase
      .from('apontamentos_tempo')
      .update({
        status: 'executando'
      })
      .eq('id', tempoPausado.id)
      .select()
      .single()

    if (!error && data) {
      // Se já existe um intervalo rodando, limpar
      if (tempoInterval[tarefaId]) {
        clearInterval(tempoInterval[tarefaId])
      }

      // Iniciar contador local
      const intervalId = setInterval(() => {
        setTempos(prev => {
          const atual = prev[tarefaId]
          if (atual?.status === 'executando') {
            return {
              ...prev,
              [tarefaId]: {
                ...atual,
                tempoAtual: (atual.tempoAtual || 0) + 1
              }
            }
          }
          return prev
        })
      }, 1000)

      setTempoInterval(prev => ({
        ...prev,
        [tarefaId]: intervalId
      }))

      setTempos(prev => ({
        ...prev,
        [tarefaId]: { 
          ...data, 
          tempoAtual: prev[tarefaId]?.tempoAtual || 0,
          status: 'executando'
        }
      }))
    }
  } else {
    // Verificar se já existe um tempo em execução (não deveria, mas vamos garantir)
    const tempoAtual = tempos[tarefaId]
    if (tempoAtual?.status === 'executando') return

    // Buscar total de tempo já registrado para esta tarefa
    const { data: temposExistentes } = await supabase
      .from('apontamentos_tempo')
      .select('*')
      .eq('tarefa_id', tarefaId)
      .eq('status', 'finalizado')

    const totalExistente = temposExistentes?.reduce((acc, t) => acc + (t.tempo_segundos || 0), 0) || 0

    // Criar novo apontamento
    const { data, error } = await supabase
      .from('apontamentos_tempo')
      .insert([{
        tarefa_id: tarefaId,
        usuario_id: user.id,
        data_inicio: new Date(),
        status: 'executando',
        tempo_segundos: totalExistente
      }])
      .select()
      .single()

    if (!error && data) {
      // Se já existe um intervalo rodando, limpar
      if (tempoInterval[tarefaId]) {
        clearInterval(tempoInterval[tarefaId])
      }

      // Iniciar contador local
      const intervalId = setInterval(() => {
        setTempos(prev => {
          const atual = prev[tarefaId]
          if (atual?.status === 'executando') {
            return {
              ...prev,
              [tarefaId]: {
                ...atual,
                tempoAtual: (atual.tempoAtual || 0) + 1
              }
            }
          }
          return prev
        })
      }, 1000)

      setTempoInterval(prev => ({
        ...prev,
        [tarefaId]: intervalId
      }))

      setTempos(prev => ({
        ...prev,
        [tarefaId]: { 
          ...data, 
          tempoAtual: totalExistente,
          status: 'executando',
          apontamentos: [data, ...(prev[tarefaId]?.apontamentos || [])]
        }
      }))
    }
  }
}

    // Criar novo apontamento
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

    if (!error && data) {
      // Iniciar contador local
      const intervalId = setInterval(() => {
        setTempos(prev => {
          const atual = prev[tarefaId]
          if (atual?.status === 'executando') {
            return {
              ...prev,
              [tarefaId]: {
                ...atual,
                tempoAtual: (atual.tempoAtual || 0) + 1
              }
            }
          }
          return prev
        })
      }, 1000)

      setTempoInterval(prev => ({
        ...prev,
        [tarefaId]: intervalId
      }))

      setTempos(prev => ({
        ...prev,
        [tarefaId]: { 
          ...data, 
          tempoAtual: 0,
          status: 'executando',
          apontamentos: [data, ...(prev[tarefaId]?.apontamentos || [])]
        }
      }))
    }
  }

  async function pausarTempo(tarefaId) {
    const tempoAtual = tempos[tarefaId]
    if (!tempoAtual || tempoAtual.status !== 'executando' || !tempoAtual.id) return

    // Parar o intervalo
    if (tempoInterval[tarefaId]) {
      clearInterval(tempoInterval[tarefaId])
    }

    // Atualizar no banco
    const { error } = await supabase
      .from('apontamentos_tempo')
      .update({
        data_fim: new Date(),
        tempo_segundos: tempoAtual.tempoAtual,
        status: 'pausado'
      })
      .eq('id', tempoAtual.id)

    if (!error) {
      setTempos(prev => ({
        ...prev,
        [tarefaId]: { 
          ...prev[tarefaId],
          status: 'pausado'
        }
      }))
    }
  }

  async function finalizarTempo(tarefaId) {
    const tempoAtual = tempos[tarefaId]
    if (!tempoAtual || !tempoAtual.id) return

    // Parar o intervalo se estiver executando
    if (tempoInterval[tarefaId]) {
      clearInterval(tempoInterval[tarefaId])
    }

    // Atualizar no banco
    const { error } = await supabase
      .from('apontamentos_tempo')
      .update({
        data_fim: new Date(),
        tempo_segundos: tempoAtual.tempoAtual || 0,
        status: 'finalizado'
      })
      .eq('id', tempoAtual.id)

    if (!error) {
      // Recarregar todos os tempos para ter o total correto
      await carregarTempoTarefa(tarefaId)
    }
  }

  function formatarTempo(segundos) {
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
    
    // Atualizar localmente
    setTarefas(prev => prev.map(t => 
      t.id === tarefaId ? { ...t, [campo]: valor } : t
    ))
  }

  async function adicionarResponsavel(tarefaId, responsavel) {
    const tarefa = tarefas.find(t => t.id === tarefaId)
    const responsaveisAtuais = tarefa.responsaveis ? tarefa.responsaveis.split(',').filter(r => r.trim()) : []
    
    if (!responsaveisAtuais.includes(responsavel)) {
      responsaveisAtuais.push(responsavel)
      await atualizarTarefa(tarefaId, 'responsaveis', responsaveisAtuais.join(','))
    }
  }

  async function removerResponsavel(tarefaId, responsavel) {
    const tarefa = tarefas.find(t => t.id === tarefaId)
    const responsaveisAtuais = tarefa.responsaveis ? tarefa.responsaveis.split(',').filter(r => r.trim()) : []
    
    const novosResponsaveis = responsaveisAtuais.filter(r => r !== responsavel)
    await atualizarTarefa(tarefaId, 'responsaveis', novosResponsaveis.join(','))
  }

  if (loading) {
    return (
      <div style={{
        background: '#0a1423',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#3d5a80',
        fontFamily: "'Barlow Condensed', sans-serif"
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
        color: '#ef4444',
        fontFamily: "'Barlow Condensed', sans-serif"
      }}>
        Projeto não encontrado
      </div>
    )
  }

  const tarefasEletrica = tarefas.filter(t => t.setor === 'eletrica')
  const tarefasMecanica = tarefas.filter(t => t.setor === 'mecanica')
  const tarefasAmbos = tarefas.filter(t => t.setor === 'ambos')

  const TaskCard = ({ tarefa, cor }) => {
    const tempo = tempos[tarefa.id] || { tempoAtual: 0, status: 'parado', apontamentos: [] }
    const responsaveis = tarefa.responsaveis ? tarefa.responsaveis.split(',').filter(r => r.trim()) : []
    const [mostrarSeletor, setMostrarSeletor] = useState(false)

    return (
      <div style={{
        background: 'rgba(22,35,58,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: `4px solid ${cor}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
      }}>
        {/* Título da tarefa */}
        <strong style={{ color: '#fff', fontSize: '16px', display: 'block', marginBottom: '8px' }}>
          {tarefa.titulo}
        </strong>

        {/* Informações do Projeto */}
        <div style={{
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '4px',
          padding: '8px',
          marginBottom: '12px',
          fontSize: '12px'
        }}>
          {projeto.numero_pedido && (
            <div style={{ color: '#94a3b8', marginBottom: '4px' }}>
              📦 PO: {projeto.numero_pedido}
            </div>
          )}
          {projeto.cliente && (
            <div style={{ color: '#94a3b8' }}>
              🏢 Cliente: {projeto.cliente}
            </div>
          )}
        </div>

        {/* Status e Prioridade */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <select
            value={tarefa.prioridade || 'Normal'}
            onChange={(e) => atualizarTarefa(tarefa.id, 'prioridade', e.target.value)}
            style={{
              background: tarefa.prioridade === 'Urgente' ? '#7f1d1d' :
                         tarefa.prioridade === 'Alta' ? '#7f1d1d' : '#334155',
              color: tarefa.prioridade === 'Urgente' ? '#f87171' :
                     tarefa.prioridade === 'Alta' ? '#fbbf24' : '#94a3b8',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            <option value="Normal">🔵 Normal</option>
            <option value="Alta">🟡 Alta</option>
            <option value="Urgente">🔴 Urgente</option>
          </select>

          <select
            value={tarefa.status || 'Pendente'}
            onChange={(e) => atualizarTarefa(tarefa.id, 'status', e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '4px 8px',
              color: '#fff',
              fontSize: '11px',
              cursor: 'pointer'
            }}
          >
            <option value="Pendente">⏳ Pendente</option>
            <option value="Em andamento">▶️ Em andamento</option>
            <option value="Aguardando">⏸️ Aguardando</option>
            <option value="Concluida">✅ Concluída</option>
          </select>
        </div>

        {/* Múltiplos Responsáveis */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#3d5a80', fontSize: '12px' }}>Responsáveis:</span>
            <button
              onClick={() => setMostrarSeletor(!mostrarSeletor)}
              style={{
                background: 'none',
                border: '1px dashed #3d5a80',
                borderRadius: '4px',
                color: '#3d5a80',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              + Adicionar
            </button>
          </div>

          {/* Lista de responsáveis atuais */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {responsaveis.map(resp => (
              <span
                key={resp}
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  color: '#f59e0b',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {resp}
                <button
                  onClick={() => removerResponsavel(tarefa.id, resp)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          {/* Seletor de responsável */}
          {mostrarSeletor && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  adicionarResponsavel(tarefa.id, e.target.value)
                  setMostrarSeletor(false)
                }
              }}
              style={{
                width: '100%',
                padding: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px'
              }}
            >
              <option value="">Selecionar...</option>
              {equipe
                .filter(p => !responsaveis.includes(p.nome))
                .map(p => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))
              }
            </select>
          )}
        </div>

        {/* Timer */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '18px' }}>
              ⏱️ {formatarTempo(tempo.tempoAtual)}
            </span>
            <span style={{
              color: tempo.status === 'executando' ? '#22c55e' : 
                     tempo.status === 'pausado' ? '#f59e0b' : '#64748b',
              fontSize: '12px'
            }}>
              {tempo.status === 'executando' ? '▶️ Em andamento' : 
               tempo.status === 'pausado' ? '⏸️ Pausado' : '⏹️ Parado'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {tempo.status !== 'executando' && (
              <button
                onClick={() => iniciarTempo(tarefa.id)}
                style={{
                  flex: 1,
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ▶️ Iniciar
              </button>
            )}
            {tempo.status === 'executando' && (
              <button
                onClick={() => pausarTempo(tarefa.id)}
                style={{
                  flex: 1,
                  background: '#f59e0b',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px',
                  color: '#000',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ⏸️ Pausar
              </button>
            )}
            {(tempo.status === 'executando' || tempo.status === 'pausado') && (
              <button
                onClick={() => finalizarTempo(tarefa.id)}
                style={{
                  flex: 1,
                  background: '#3b82f6',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px',
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                ✅ Finalizar
              </button>
            )}
          </div>

          {/* Histórico de apontamentos */}
          {tempo.apontamentos && tempo.apontamentos.length > 1 && (
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#3d5a80' }}>
              {tempo.apontamentos.filter(a => a.status === 'finalizado').length} sessões registradas
            </div>
          )}
        </div>

        {/* Prazo */}
        {tarefa.prazo && (
          <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'right' }}>
            📅 Prazo: {new Date(tarefa.prazo).toLocaleDateString('pt-BR')}
          </div>
        )}
      </div>
    )
  }

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
        {/* Cabeçalho */}
        <button
          onClick={() => router.push('/projetos')}
          style={{
            background: 'none',
            border: 'none',
            color: '#3d5a80',
            fontSize: '16px',
            cursor: 'pointer',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ← Voltar para Projetos
        </button>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ color: '#f59e0b', fontSize: '32px', marginBottom: '8px' }}>{projeto.nome}</h1>
          <div style={{ display: 'flex', gap: '20px', color: '#94a3b8', fontSize: '14px' }}>
            {projeto.numero_pedido && <span>📦 PO: {projeto.numero_pedido}</span>}
            {projeto.cliente && <span>🏢 Cliente: {projeto.cliente}</span>}
          </div>
        </div>

        {/* Grid de tarefas */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Coluna Geral */}
          <div>
            <h2 style={{ 
              color: '#f59e0b', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📋 Geral</span>
              <span style={{
                background: 'rgba(245,158,11,0.1)',
                color: '#f59e0b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {tarefasAmbos.length}
              </span>
            </h2>
            {tarefasAmbos.map(tarefa => (
              <TaskCard key={tarefa.id} tarefa={tarefa} cor="#f59e0b" />
            ))}
          </div>

          {/* Coluna Elétrica */}
          <div>
            <h2 style={{ 
              color: '#3b82f6', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚡ Elétrica</span>
              <span style={{
                background: 'rgba(59,130,246,0.1)',
                color: '#3b82f6',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {tarefasEletrica.length}
              </span>
            </h2>
            {tarefasEletrica.map(tarefa => (
              <TaskCard key={tarefa.id} tarefa={tarefa} cor="#3b82f6" />
            ))}
          </div>

          {/* Coluna Mecânica */}
          <div>
            <h2 style={{ 
              color: '#10b981', 
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🔧 Mecânica</span>
              <span style={{
                background: 'rgba(16,185,129,0.1)',
                color: '#10b981',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px'
              }}>
                {tarefasMecanica.length}
              </span>
            </h2>
            {tarefasMecanica.map(tarefa => (
              <TaskCard key={tarefa.id} tarefa={tarefa} cor="#10b981" />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
