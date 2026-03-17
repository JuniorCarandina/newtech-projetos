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
    const { data } = await supabase
      .from('apontamentos_tempo')
      .select(`
        *,
        tarefa:tarefas(
          titulo,
          projeto:projetos(nome, numero_pedido)
        )
      `)
      .eq('status', 'finalizado')
      .order('data_inicio', { ascending: false })

    // Buscar nomes dos usuários
    const dadosCompletos = await Promise.all(data?.map(async (item) => {
      const { data: userData } = await supabase
        .from('equipe')
        .select('nome')
        .eq('id', item.usuario_id)
        .single()

      const horas = Math.floor(item.tempo_segundos / 3600)
      const minutos = Math.floor((item.tempo_segundos % 3600) / 60)
      const segundos = item.tempo_segundos % 60
      const tempoFormatado = `${horas.toString().padStart(2,'0')}:${minutos.toString().padStart(2,'0')}:${segundos.toString().padStart(2,'0')}`

      return {
        ...item,
        responsavel: userData?.nome || 'Desconhecido',
        tempo: tempoFormatado
      }
    }) || [])

    setDados(dadosCompletos)
    setLoading(false)
  }

  function formatarData(data) {
    return new Date(data).toLocaleDateString('pt-BR')
  }

  return (
    <>
      <Head><title>Relatório de Horas</title></Head>
      <div style={{ background: '#0a1423', minHeight: '100vh', padding: '20px' }}>
        <button onClick={() => router.push('/projetos')} style={{ background: 'none', border: 'none', color: '#888', marginBottom: '20px', cursor: 'pointer' }}>
          ← Voltar
        </button>

        <h1 style={{ color: '#f59e0b', marginBottom: '20px' }}>📊 Relatório de Horas</h1>

        {loading ? (
          <p style={{ color: '#fff' }}>Carregando...</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#1a2635', borderRadius: '8px' }}>
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
                  <td style={{ padding: '12px', color: '#fff' }}>{formatarData(item.data_inicio)}</td>
                  <td style={{ padding: '12px', color: '#fff' }}>{item.responsavel}</td>
                  <td style={{ padding: '12px', color: '#fff' }}>
                    {item.tarefa?.projeto?.nome}
                    {item.tarefa?.projeto?.numero_pedido && <span style={{ color: '#888', fontSize: '12px', display: 'block' }}>PO: {item.tarefa.projeto.numero_pedido}</span>}
                  </td>
                  <td style={{ padding: '12px', color: '#fff' }}>{item.tarefa?.titulo}</td>
                  <td style={{ padding: '12px', color: '#f59e0b', fontWeight: 'bold' }}>{item.tempo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
