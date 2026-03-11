// src/App.jsx
import { onMount, onCleanup, createSignal } from 'solid-js';
import createGame from './Game';

function App() {
  let gameContainer; // Phaser 캔버스가 들어갈 div의 ref
  let gameInstance; // Phaser 게임 인스턴스를 저장할 변수

  const [killer1On, setKiller1On] = createSignal(true);
  const [killer2On, setKiller2On] = createSignal(true);
  const [showVision, setShowVision] = createSignal(false);

  const toggleKiller = (id) => {
    if (id === 1) {
      const newState = !killer1On();
      setKiller1On(newState);
      if (window.toggleAgent) window.toggleAgent(1, newState);
    } else {
      const newState = !killer2On();
      setKiller2On(newState);
      if (window.toggleAgent) window.toggleAgent(2, newState);
    }
  };

  const toggleVision = () => {
    const newState = !showVision();
    setShowVision(newState);
    if (window.toggleKillerVision) window.toggleKillerVision(newState);
  };

  onMount(() => {
    // 컴포넌트가 화면에 붙을 때 Phaser 게임 생성
    if (!gameInstance) {
      gameInstance = createGame(gameContainer);
    }
  });

  onCleanup(() => {
    // 컴포넌트가 사라질 때 게임 인스턴스 파괴 (메모리 관리)
    if (gameInstance) {
      gameInstance.destroy(true);
      gameInstance = null;
    }
  });

  return (
    <div style={{
      display: 'flex',
      "flex-direction": 'column',
      height: '100vh',
      background: '#0a0a0a',
      color: '#0f0',
      "font-family": 'monospace'
    }}>
      {/* 상단 오퍼레이션 헤더 */}
      <header style={{ padding: '15px', "border-bottom": '2px solid #0f0' }}>
        <h1 style={{ margin: 0 }}>HITMAN OFFICE: REAL-TIME OP.</h1>
        <p style={{ margin: 0 }}>상태: [ 위성 해킹 완료 ] | 현장: 샌프란시스코 은신처</p>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* 사이드바: 작전 요약 및 무전 */}
        <aside style={{ width: '220px', "border-right": '1px solid #0f0', padding: '15px', "background-color": '#000', display: 'flex', 'flex-direction': 'column' }}>
          <div>
            <h3 style={{ "border-bottom": '1px solid #0f0' }}>AGENTS</h3>
            <div
              style={{ "margin-bottom": '10px', color: killer1On() ? '#00ff00' : '#444', cursor: 'pointer', 'user-select': 'none' }}
              onClick={() => toggleKiller(1)}
              onMouseOver={(e) => { if (killer1On()) e.target.style.color = '#fff'; }}
              onMouseOut={(e) => { if (killer1On()) e.target.style.color = '#00ff00'; }}
            >
              [{killer1On() ? 'ON ' : 'OFF'}] KILLER 1 - {killer1On() ? '대기 중' : '비활성'}
            </div>
            <div
              style={{ "margin-bottom": '10px', color: killer2On() ? '#00ffff' : '#444', cursor: 'pointer', 'user-select': 'none' }}
              onClick={() => toggleKiller(2)}
              onMouseOver={(e) => { if (killer2On()) e.target.style.color = '#fff'; }}
              onMouseOut={(e) => { if (killer2On()) e.target.style.color = '#00ffff'; }}
            >
              [{killer2On() ? 'ON ' : 'OFF'}] KILLER 2 - {killer2On() ? '대기 중' : '비활성'}
            </div>
            <h3 style={{ "border-bottom": '1px solid #0f0', "margin-top": '20px' }}>TARGET</h3>
            <div style={{ "margin-bottom": '10px', color: '#ff0000' }}>[ON] TARGET - 미식별</div>

            <h3 style={{ "border-bottom": '1px solid #0f0', "margin-top": '20px' }}>OPTIONS</h3>
            <div
              style={{ "margin-bottom": '10px', color: showVision() ? '#fff' : '#444', cursor: 'pointer', 'user-select': 'none' }}
              onClick={toggleVision}
              onMouseOver={(e) => { e.target.style.color = showVision() ? '#fff' : '#888'; }}
              onMouseOut={(e) => { e.target.style.color = showVision() ? '#fff' : '#444'; }}
            >
              [{showVision() ? 'ON ' : 'OFF'}] 킬러 시야각 식별
            </div>
          </div>

          <div style={{ 'margin-top': 'auto' }}>
            <button
              style={{
                width: '100%',
                padding: '10px',
                background: '#f00',
                color: '#fff',
                border: '1px solid #fff',
                cursor: 'pointer',
                'font-family': 'monospace',
                'font-weight': 'bold',
                'font-size': '14px'
              }}
              onClick={() => window.commandAutoAttack && window.commandAutoAttack()}
              onMouseOver={(e) => e.target.style.background = '#d00'}
              onMouseOut={(e) => e.target.style.background = '#f00'}
            >
              [ 자율 교전 (SEEK & DESTROY) ]
            </button>
            <div style={{ 'font-size': '10px', color: '#888', 'margin-top': '5px', 'text-align': 'center' }}>전 요원 타겟 강제 추적</div>
          </div>
        </aside>

        {/* 메인 작전 화면: Phaser 캔버스 */}
        <main style={{ flex: 1, position: 'relative', background: '#000' }}>
          <div ref={gameContainer} style={{ width: '800px', height: '600px', margin: 'auto' }} />
        </main>
      </div>

      {/* 하단 명령 콘솔 */}
      <footer style={{ height: '80px', "border-top": '2px solid #0f0', padding: '10px', "background-color": '#000' }}>
        <label>명령 입력_ </label>
        <input
          type="text"
          placeholder="[MOVE [AGENT] [X,Y]]..."
          style={{ width: '80%', background: '#000', color: '#0f0', border: 'none', outline: 'none', "font-size": '16px' }}
        />
      </footer>
    </div>
  );
}

export default App;