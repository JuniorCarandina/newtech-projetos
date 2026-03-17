import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Relatorio() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroData, setFiltroData] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [usuarios, setUsuarios] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else {
        setUser(data.session.user)
        carregarRelatorio()
        carregarUsuarios()
      }
    })
  }, [])

  async function carregarUsuarios() {
    const { data } = await supabase
      .from('equipe')
      .select('*')
      .eq('ativo', true)
    setUsuarios(data || [])
  }

  async function carregarRelatorio() {
    setLoading(true)

    let query = supabase
      .from('apontamentos_tempo')
      .select(`
        *,
        tarefa:tarefas(
          id,
          titulo,
          setor,
          projeto:projetos(
            nome,
            numero_pedido,
            cliente
          )
        )
      `)
      .eq('status', 'finalizado')
      .order('data_inicio', { ascending: false })

    if (filtroData) {
      const dataInicio = new Date(filtroData)
      dataInicio.setHours(0,0,0,0)
      const dataFim = new Date(filtroData)
      dataFim.setHours(23,59,59,999)
      
      query = query
        .gte('data_inicio', dataInicio.toISOString())
        .lte('data_inicio', dataFim.toISOString())
    }

    const { data } = await query

    // Buscar emails dos usuários
    const dadosCompletos = await Promise.all(data?.map(async (item) => {
      const { data: userData } = await supabase.auth.admin.getUserById(item.usuario_id)
      return {
        ...item,
        usuario_email: userData?.user?.email || 'Desconhecido',
        tempo_formatado: formatarTempo(item.tempo_segundos || 0)
      }
    }) || [])

    // Filtrar por usuário se selecionado
    const dadosFiltrados = filtroUsuario 
      ? dadosCompletos.filter(d => d.usuario_id === filtroUsuario)
      : dadosCompletos

    setDados(dadosFiltrados)
    setLoading(false)
  }

  function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
  }

  // Agrupar por usuário
  const dadosPorUsuario = dados.reduce((acc, item) => {
    const usuarioId = item.usuario_id
    if (!acc[usuarioId]) {
      acc[usuarioId] = {
        email: item.usuario_email,
        total: 0,
        tarefas: [],
        registros: []
      }
    }
    acc[usuarioId].total += item.tempo_segundos || 0
    acc[usuarioId].registros.push(item)
    if (!acc[usuarioId].tarefas.includes(item.tarefa?.titulo)) {
      acc[usuarioId].tarefas.push(item.tarefa?.titulo)
    }
    return acc
  }, {})

  if (!user) return null

  return (
    <>
      <Head>
        <title>New Tech · Relatório de Horas</title>
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
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}>
          <div>
            <h1 style={{ color: '#f59e0b', fontSize: '32px', margin: 0 }}>RELATÓRIO DE HORAS</h1>
            <p style={{ color: '#3d5a80', margin: 0 }}>Acompanhe o tempo gasto por cada responsável</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => router.push('/projetos')}
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
              onClick={carregarRelatorio}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                color: '#fff',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              🔍 Atualizar
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div style={{
          background: 'rgba(22,35,58,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ color: '#3d5a80', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Filtrar por Data
            </label>
            <input
              type="date"
              value={filtroData}
              onChange={(e) => {
                setFiltroData(e.target.value)
                setTimeout(carregarRelatorio, 100)
              }}
              style={{
                padding: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#fff'
              }}
            />
          </div>

          <div>
            <label style={{ color: '#3d5a80', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
              Filtrar por Responsável
            </label>
            <select
              value={filtroUsuario}
              onChange={(e) => {
                setFiltroUsuario(e.target.value)
                setTimeout(carregarRelatorio, 100)
              }}
              style={{
                padding: '8px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '4px',
                color: '#fff',
                minWidth: '200px'
              }}
            >
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards de Resumo por Usuário */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {Object.entries(dadosPorUsuario).map(([usuarioId, info]) => (
            <div
              key={usuarioId}
              style={{
                background: 'rgba(22,35,58,0.9)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '8px',
                padding: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#000'
                }}>
                  {info.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>{info.email}</div>
                  <div style={{ color: '#3d5a80', fontSize: '12px' }}>
                    {info.tarefas.length} tarefas · {info.registros.length} registros
                  </div>
                </div>
              </div>
              
              <div style={{
                fontSize: '24px',
                color: '#f59e0b',
                fontWeight: 'bold',
                textAlign: 'center',
                padding: '12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '4px'
              }}>
                {formatarTempo(info.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Tabela Detalhada */}
        <div style={{
          background: 'rgba(22,35,58,0.9)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h2 style={{ color: '#f59e0b', marginBottom: '16px' }}>📋 Registros Detalhados</h2>
          
          {dados.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#3d5a80' }}>
              Nenhum registro encontrado
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Data</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Responsável</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Projeto</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Tarefa</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Setor</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: '#3d5a80' }}>Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>
                        {new Date(item.data_inicio).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '12px', color: '#fff' }}>
                        {item.usuario_email}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ color: '#fff' }}>{item.tarefa?.projeto?.nome || '-'}</div>
                        {item.tarefa?.projeto?.numero_pedido && (
                          <div style={{ color: '#3d5a80', fontSize: '11px' }}>
                            PO: {item.tarefa.projeto.numero_pedido}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#fff' }}>{item.tarefa?.titulo || '-'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: item.tarefa?.setor === 'eletrica' ? 'rgba(59,130,246,0.1)' :
                                     item.tarefa?.setor === 'mecanica' ? 'rgba(16,185,129,0.1)' :
                                     'rgba(245,158,11,0.1)',
                          color: item.tarefa?.setor === 'eletrica' ? '#3b82f6' :
                                 item.tarefa?.setor === 'mecanica' ? '#10b981' :
                                 '#f59e0b',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px'
                        }}>
                          {item.tarefa?.setor || 'geral'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#f59e0b', fontWeight: 'bold' }}>
                        {item.tempo_formatado}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
