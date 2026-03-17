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
    // Verificar se tem tempo em andamento
    const { data: ativo } = await supabase
      .from('apontamentos_tempo')
      .select('*')
      .eq('tarefa_id', tarefaId)
      .eq('status', 'executando')
      .maybeSingle()

    if (ativo) {
      const inicio = new Date(ativo.data_inicio)
      const agora = new Date()
      const segundosPassados = Math.floor((agora - inicio) / 1000)
      
      setTempos(prev => ({
        ...prev,
        [tarefaId]: {
          ...ativo,
          tempoAtual: (ativo.tempo_segundos || 0) + segundosPassados,
          status: 'executando'
        }
      }))
    } else {
      // Buscar total de tempo já registrado
      const { data: historico } = await supabase
        .from('apontamentos_tempo')
        .select('tempo_segundos')
        .eq('tarefa_id', tarefaId)
        .eq('status', 'finalizado')

      const totalSegundos = historico?.reduce((acc, item) => acc + (item.tempo_segundos || 0), 0) || 0
      
      setTempos(prev => ({
        ...prev,
        [tarefaId]: { tempoAtual: totalSegundos, status: 'parado' }
      }))
    }
  }

  async function iniciarTempo(tarefaId) {
    if (!user) return

    // Parar qualquer tempo ativo do usuário
    await supabase
      .from('apontamentos_tempo')
      .update({ status: 'pausado' })
      .eq('usuario_id', user.id)
      .eq('status', 'executando')

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
      setTempos(prev => ({
        ...prev,
        [tarefaId]: { ...data, tempoAtual: 0, status: 'executando' }
      }))
    }
  }

  async function pausarTempo(tarefaId) {
    const tempoAtual = tempos[tarefaId]
    if (!tempoAtual || tempoAtual.status !== 'executando' || !tempoAtual.id) return

    await supabase
      .from('apontamentos_tempo')
      .update({
        status: 'pausado'
      })
      .eq('id', tempoAtual.id)

    await carregarTempoTarefa(tarefaId)
  }

  async function finalizarTempo(tarefaId) {
    const tempoAtual = tempos[tarefaId]
    if (!tempoAtual || !tempoAtual.id) return

    await supabase
      .from('apontamentos_tempo')
      .update({
        data_fim: new Date(),
        status: 'finalizado'
      })
      .eq('id', tempoAtual.id)

    await carregarTempoTarefa(tarefaId)
  }

  function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTempos(prev => {
        const novo = { ...prev }
        Object.keys(novo).forEach(key => {
          if (novo[key].status === 'executando') {
            novo[key].tempoAtual = (novo[key].tempoAtual || 0) + 1
          }
        })
        return novo
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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
    const tempo = tempos[tarefa.id] || { tempoAtual: 0, status: 'parado' }

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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <span style={{
            background: tarefa.prioridade === 'Urgente' ? '#7f1d1d' :
                       tarefa.prioridade === 'Alta' ? '#7f1d1d' : '#334155',
            color: tarefa.prioridade === 'Urgente' ? '#f87171' :
                   tarefa.prioridade === 'Alta' ? '#fbbf24' : '#94a3b8',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {tarefa.prioridade || 'Normal'}
          </span>
          <select
            value={tarefa.status || 'Pendente'}
            onChange={(e) => atualizarStatus(tarefa.id, e.target.value)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              padding: '2px 8px',
              color: '#fff',
              fontSize: '11px'
            }}
          >
            <option value="Pendente">⏳ Pendente</option>
            <option value="Em andamento">▶️ Em andamento</option>
            <option value="Concluida">✅ Concluída</option>
          </select>
        </div>

        {/* Responsável */}
        <select
          value={tarefa.responsavel || ''}
          onChange={e => atualizarResponsavel(tarefa.id, e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '13px'
          }}
        >
          <option value="">Selecionar responsável...</option>
          {equipe.map(p => (
            <option key={p.id} value={p.nome}>{p.nome}</option>
          ))}
        </select>

        {/* Timer */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '14px' }}>
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
            {tarefasAmbos.length === 0 && (
              <div style={{ color: '#3d5a80', textAlign: 'center', padding: '20px' }}>
                Nenhuma tarefa geral
              </div>
            )}
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
            {tarefasEletrica.length === 0 && (
              <div style={{ color: '#3d5a80', textAlign: 'center', padding: '20px' }}>
                Nenhuma tarefa elétrica
              </div>
            )}
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
            {tarefasMecanica.length === 0 && (
              <div style={{ color: '#3d5a80', textAlign: 'center', padding: '20px' }}>
                Nenhuma tarefa mecânica
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
