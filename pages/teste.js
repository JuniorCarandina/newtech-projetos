import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Teste() {
  const [tarefas, setTarefas] = useState([])
  const [equipe, setEquipe] = useState([])
  const [tempos, setTempos] = useState({})
  const [tempoAtivo, setTempoAtivo] = useState(null)

  useEffect(() => {
    carregarTarefas()
    carregarEquipe()
  }, [])

  // Timer que atualiza a cada segundo
  useEffect(() => {
    let interval
    if (tempoAtivo) {
      interval = setInterval(() => {
        setTempos(prev => ({
          ...prev,
          [tempoAtivo]: (prev[tempoAtivo] || 0) + 1
        }))
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [tempoAtivo])

  async function carregarTarefas() {
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .limit(10)
    setTarefas(data || [])
  }

  async function carregarEquipe() {
    const { data } = await supabase
      .from('equipe')
      .select('*')
    setEquipe(data || [])
  }

  function iniciar(tarefaId) {
    // Se já tem um tempo ativo, pausa ele primeiro
    if (tempoAtivo) {
      pausar(tempoAtivo)
    }
    setTempoAtivo(tarefaId)
    setTempos(prev => ({ ...prev, [tarefaId]: prev[tarefaId] || 0 }))
  }

  function pausar(tarefaId) {
    if (tempoAtivo === tarefaId) {
      setTempoAtivo(null)
    }
  }

  function finalizar(tarefaId) {
    // Aqui depois vamos salvar no banco
    alert(`Tempo finalizado: ${tempos[tarefaId] || 0} segundos`)
    setTempoAtivo(null)
    setTempos(prev => ({ ...prev, [tarefaId]: 0 }))
  }

  function formatarTempo(segundos) {
    if (!segundos) return '00:00:00'
    const horas = Math.floor(segundos / 3600)
    const minutos = Math.floor((segundos % 3600) / 60)
    const segs = segundos % 60
    return `${horas.toString().padStart(2,'0')}:${minutos.toString().padStart(2,'0')}:${segs.toString().padStart(2,'0')}`
  }

  return (
    <div style={{ 
      background: '#0a1423', 
      minHeight: '100vh', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#f59e0b', marginBottom: '30px' }}>⏱️ TESTE DO CONTADOR</h1>
      
      {tarefas.map(tarefa => (
        <div key={tarefa.id} style={{
          background: '#1a2635',
          border: '1px solid #2a3745',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '15px'
        }}>
          <h3 style={{ color: '#fff', margin: '0 0 15px 0' }}>{tarefa.titulo}</h3>
          
          {/* Responsável */}
          <select style={{
            width: '100%',
            padding: '8px',
            marginBottom: '15px',
            background: '#2a3745',
            color: '#fff',
            border: '1px solid #3a4755',
            borderRadius: '4px'
          }}>
            <option value="">Selecionar responsável</option>
            {equipe.map(pessoa => (
              <option key={pessoa.id} value={pessoa.nome}>{pessoa.nome}</option>
            ))}
          </select>

          {/* Timer e Botões */}
          <div style={{
            background: '#0f1a24',
            padding: '15px',
            borderRadius: '6px'
          }}>
            <div style={{
              fontSize: '32px',
              color: '#f59e0b',
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: '15px',
              fontFamily: 'monospace'
            }}>
              {formatarTempo(tempos[tarefa.id])}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {tempoAtivo !== tarefa.id ? (
                <button
                  onClick={() => iniciar(tarefa.id)}
                  style={{
                    flex: 1,
                    background: '#22c55e',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '4px',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ▶️ INICIAR
                </button>
              ) : (
                <button
                  onClick={() => pausar(tarefa.id)}
                  style={{
                    flex: 1,
                    background: '#f59e0b',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '4px',
                    color: '#000',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ⏸️ PAUSAR
                </button>
              )}
              
              <button
                onClick={() => finalizar(tarefa.id)}
                style={{
                  flex: 1,
                  background: '#3b82f6',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '4px',
                  color: '#fff',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                ✅ FINALIZAR
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
