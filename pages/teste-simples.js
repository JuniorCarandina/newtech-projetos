import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function TesteSimples() {
  const [tarefas, setTarefas] = useState([])
  const [equipe, setEquipe] = useState([])
  const [tempoAtual, setTempoAtual] = useState({})

  useEffect(() => {
    carregarTarefas()
    carregarEquipe()
  }, [])

  async function carregarTarefas() {
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .limit(5)
    setTarefas(data || [])
  }

  async function carregarEquipe() {
    const { data } = await supabase
      .from('equipe')
      .select('*')
    setEquipe(data || [])
  }

  function iniciar(tarefaId) {
    setTempoAtual(prev => ({ ...prev, [tarefaId]: 0 }))
    const interval = setInterval(() => {
      setTempoAtual(prev => ({
        ...prev,
        [tarefaId]: (prev[tarefaId] || 0) + 1
      }))
    }, 1000)
  }

  function pausar(tarefaId) {
    // só para o intervalo - depois implementamos
  }

  return (
    <div style={{ padding: '20px', background: '#0a1423', minHeight: '100vh', color: '#fff' }}>
      <h1 style={{ color: '#f59e0b' }}>📋 TESTE SIMPLES</h1>
      
      {tarefas.map(tarefa => (
        <div key={tarefa.id} style={{
          background: '#1a2635',
          padding: '15px',
          marginBottom: '10px',
          borderRadius: '5px'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>{tarefa.titulo}</div>
          
          <select style={{ marginBottom: '10px', padding: '5px' }}>
            <option>Selecionar responsável</option>
            {equipe.map(p => <option key={p.id}>{p.nome}</option>)}
          </select>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px', color: '#f59e0b' }}>
              {tempoAtual[tarefa.id] || 0}s
            </span>
            <button onClick={() => iniciar(tarefa.id)} style={{ padding: '5px 15px' }}>
              ▶️ Iniciar
            </button>
            <button onClick={() => pausar(tarefa.id)} style={{ padding: '5px 15px' }}>
              ⏸️ Pausar
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
