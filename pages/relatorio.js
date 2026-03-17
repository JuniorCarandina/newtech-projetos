import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'

export default function Relatorio() {
  const router = useRouter()
  const [dados, setDados] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregarRelatorio()
  }, [])

  async function carregarRelatorio() {
    setLoading(true)
    
    // Buscar todos os apontamentos finalizados
    const { data: apontamentos, error } = await supabase
      .from('apontamentos_tempo')
      .select('*')
      .eq('status', 'finalizado')
      .order('data_inicio', { ascending: false })

    if (error) {
      console.error('Erro ao carregar:', error)
      setLoading(false)
      return
    }

    // Buscar tarefas e projetos separadamente
    const dadosCompletos = []
    
    for (const item of apontamentos || []) {
      // Buscar tarefa
      const { data: tarefa } = await supabase
        .from('tarefas')
        .select('titulo, projeto_id')
        .eq('id', item.tarefa_id)
        .single()

      // Buscar projeto
      let projetoNome = '-'
      let projetoPO = ''
      if (tarefa?.projeto_id) {
        const { data: projeto } = await supabase
          .from('projetos')
          .select('nome, numero_pedido')
          .eq('id', tarefa.projeto_id)
          .single()
        
        projetoNome = projeto?.nome || '-'
        projetoPO = projeto?.numero_pedido || ''
      }

      // Buscar responsável na equipe
      const { data: responsavel } = await supabase
        .from('equipe')
        .select('nome')
        .eq('id', item.usuario_id)
        .maybeSingle()

      // Formatar tempo
      const horas = Math.floor(item.tempo_segundos / 3600)
      const minutos = Math.floor((item.tempo_segundos % 3600) / 60)
      const segundos = item.tempo_segundos % 60
      const tempoFormatado = `${horas.toString().padStart(2,'0')}:${minutos.toString().padStart(2,'0')}:${segundos.toString().padStart(2,'0')}`

      dadosCompletos.push({
        id: item.id,
        data: new Date(item.data_inicio).toLocaleDateString('pt-BR'),
        responsavel: responsavel?.nome || 'Desconhecido',
        projeto: projetoNome,
        po: projetoPO,
        tarefa: tarefa?.titulo || '-',
        tempo: tempoFormatado,
        segundos: item.tempo_segundos
      })
    }

    setDados(dadosCompletos)
    setLoading(false)
  }

  // Calcular totais
  const totalSegundos = dados.reduce((acc, item) => acc + (item.segundos || 0), 0)
  const totalHoras = Math.floor(totalSegundos / 3600)
  const totalMinutos = Math.floor((totalSegundos % 3600) / 60)
  const totalFormatado = `${totalHoras.toString().padStart(2,'0')}:${totalMinutos.toString().padStart(2,'0')}`

  // Agrupar por responsável
  const porResponsavel = dados.reduce((acc, item) => {
    if (!acc[item.responsavel]) {
      acc[item.responsavel] = {
        total: 0,
        quantidade: 0
      }
    }
    acc[item.responsavel].total += item.segundos || 0
    acc[item.responsavel].quantidade += 1
    return acc
  }, {})

  return (
    <>
      <Head>
        <title>New Tech · Relatório</title>
      </Head>
      
      <div style={{ background: '#0a1423', minHeight: '100vh', padding: '20px', fontFamily: 'Arial' }}>
        <button 
          onClick={() => router.push('/projetos')}
          style={{
            background: '#2a3745',
            border: 'none',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '20px'
          }}
        >
          ← Voltar
        </button>

        <h1 style={{ color: '#f59e0b', marginBottom: '20px' }}>📊 Relatório de Horas</h1>

        {/* Cards de resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#1a2635', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Total de Horas</div>
            <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 'bold' }}>{totalFormatado}</div>
          </div>
          <div style={{ background: '#1a2635', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Registros</div>
            <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: 'bold' }}>{dados.length}</div>
          </div>
          <div style={{ background: '#1a2635', padding: '16px', borderRadius: '8px' }}>
            <div style={{ color: '#888', fontSize: '14px' }}>Responsáveis</div>
            <div style={{ color: '#10b981', fontSize: '24px', fontWeight: 'bold' }}>{Object.keys(porResponsavel).length}</div>
          </div>
        </div>

        {/* Por Responsável */}
        <div style={{ background: '#1a2635', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <h2 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>Por Responsável</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {Object.entries(porResponsavel).map(([nome, info]) => {
              const horas = Math.floor(info.total / 3600)
              const minutos = Math.floor((info.total % 3600) / 60)
              return (
                <div key={nome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a3745', paddingBottom: '8px' }}>
                  <span style={{ color: '#fff' }}>{nome}</span>
                  <span style={{ color: '#f59e0b' }}>{horas}h {minutos}m ({info.quantidade} registros)</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabela detalhada */}
        {loading ? (
          <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Carregando...</div>
        ) : (
          <div style={{ background: '#1a2635', borderRadius: '8px', padding: '16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a3745' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>Data</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>Responsável</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>Projeto</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>Tarefa</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#888' }}>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #2a3745' }}>
                    <td style={{ padding: '12px', color: '#fff' }}>{item.data}</td>
                    <td style={{ padding: '12px', color: '#fff' }}>{item.responsavel}</td>
                    <td style={{ padding: '12px', color: '#fff' }}>
                      {item.projeto}
                      {item.po && <div style={{ color: '#888', fontSize: '12px' }}>PO: {item.po}</div>}
                    </td>
                    <td style={{ padding: '12px', color: '#fff' }}>{item.tarefa}</td>
                    <td style={{ padding: '12px', color: '#f59e0b', fontWeight: 'bold' }}>{item.tempo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
