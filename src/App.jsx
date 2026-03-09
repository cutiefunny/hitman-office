// src/App.jsx
import { onMount, onCleanup } from 'solid-js';
import createGame from './Game';

function App() {
  let gameContainer; // Phaser 캔버스가 들어갈 div의 ref
  let gameInstance; // Phaser 게임 인스턴스를 저장할 변수

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
        <aside style={{ width: '220px', "border-right": '1px solid #0f0', padding: '15px', "background-color": '#000' }}>
          <h3 style={{ "border-bottom": '1px solid #0f0' }}>AGENTS</h3>
          <div style={{ "margin-bottom": '10px', color: '#00ff00' }}>[ON] KILLER 1 - 대기 중</div>
          <h3 style={{ "border-bottom": '1px solid #0f0', "margin-top": '20px' }}>TARGET</h3>
          <div style={{ "margin-bottom": '10px', color: '#ff0000' }}>[ON] TARGET - 미식별</div>
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