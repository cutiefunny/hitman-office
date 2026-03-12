import { onMount, onCleanup, createSignal, Show, For } from 'solid-js';
import createGame from './Game';
import DevPage from './DevPage';
import { loadConfig, getKillers } from './data/AgentConfig';

function App() {
  let gameContainer; // Phaser 캔버스가 들어갈 div의 ref
  let gameInstance; // Phaser 게임 인스턴스를 저장할 변수

  const [killerStates, setKillerStates] = createSignal({}); // { [id]: boolean }

  const [showVision, setShowVision] = createSignal(false);
  const [showTargetVision, setShowTargetVision] = createSignal(false);
  const [targetCounterOn, setTargetCounterOn] = createSignal(false);
  const [isDevMode, setIsDevMode] = createSignal(window.location.hash === '#dev');
  const [isLoading, setIsLoading] = createSignal(true);

  const [killers, setKillers] = createSignal(getKillers());
  const [agentInfo, setAgentInfo] = createSignal(null);
  window.updateAgentInfo = setAgentInfo;

  const toggleKiller = (id) => {
    const currentState = !!killerStates()[id];
    const newState = !currentState;
    setKillerStates({ ...killerStates(), [id]: newState });
    if (window.toggleAgent) window.toggleAgent(id, newState);
  };

  const toggleVision = () => {
    const newState = !showVision();
    setShowVision(newState);
    if (window.toggleKillerVision) window.toggleKillerVision(newState);
  };

  const toggleTargetVision = () => {
    const newState = !showTargetVision();
    setShowTargetVision(newState);
    if (window.toggleTargetVision) window.toggleTargetVision(newState);
  };

  const toggleTargetCounter = () => {
    const newState = !targetCounterOn();
    setTargetCounterOn(newState);
    if (window.toggleTargetCounter) window.toggleTargetCounter(newState);
  };

  onMount(async () => {
    // Firebase 데이터 로드
    await loadConfig();
    setKillers(getKillers()); // 로드된 데이터를 시그널에 반영
    setIsLoading(false);

    // 컴포넌트가 화면에 붙을 때 Phaser 게임 생성
    if (!gameInstance && !isDevMode()) {
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

  const renderMainLayout = () => (
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
            <For each={killers()}>{(k) => {
              const isOn = () => !!killerStates()[k.id];
              const colorHex = '#' + k.color.toString(16).padStart(6, '0');
              return (
                <div
                  style={{ "margin-bottom": '10px', color: isOn() ? colorHex : '#444', cursor: 'pointer', 'user-select': 'none' }}
                  onClick={() => toggleKiller(k.id)}
                  onMouseOver={(e) => { if (isOn()) e.target.style.color = '#fff'; }}
                  onMouseOut={(e) => { if (isOn()) e.target.style.color = isOn() ? colorHex : '#444'; }}
                >
                  [{isOn() ? 'ON ' : 'OFF'}] {k.name} - {isOn() ? '대기 중' : '비활성'}
                </div>
              );
            }}</For>
            <h3 style={{ "border-bottom": '1px solid #0f0', "margin-top": '20px' }}>TARGET</h3>
            <div style={{ "margin-bottom": '10px', color: '#ff0000' }}>[ON] TARGET - 미식별</div>
            <div
              style={{ "margin-bottom": '10px', color: targetCounterOn() ? '#ff5555' : '#444', cursor: 'pointer', 'user-select': 'none' }}
              onClick={toggleTargetCounter}
              onMouseOver={(e) => { e.target.style.color = targetCounterOn() ? '#fff' : '#888'; }}
              onMouseOut={(e) => { e.target.style.color = targetCounterOn() ? '#ff5555' : '#444'; }}
            >
              [{targetCounterOn() ? 'ON ' : 'OFF'}] 타겟 자동 반격 (권총)
            </div>
            <div
              style={{ "margin-bottom": '10px', color: showTargetVision() ? '#fff' : '#444', cursor: 'pointer', 'user-select': 'none' }}
              onClick={toggleTargetVision}
              onMouseOver={(e) => { e.target.style.color = showTargetVision() ? '#fff' : '#888'; }}
              onMouseOut={(e) => { e.target.style.color = showTargetVision() ? '#fff' : '#444'; }}
            >
              [{showTargetVision() ? 'ON ' : 'OFF'}] 타겟 시야각 식별
            </div>

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
            <div style={{ 'font-size': '10px', color: '#888', 'margin-top': '5px', 'text-align': 'center', 'margin-bottom': '15px' }}>전 요원 타겟 강제 추적</div>

            <button
              style={{
                width: '100%',
                padding: '10px',
                background: '#444',
                color: '#fff',
                border: '1px solid #777',
                cursor: 'pointer',
                'font-family': 'monospace',
                'font-weight': 'bold',
                'font-size': '14px'
              }}
              onClick={() => {
                window.location.hash = '#dev';
                setIsDevMode(true);
                if (gameInstance) {
                  gameInstance.destroy(true);
                  gameInstance = null;
                }
              }}
              onMouseOver={(e) => e.target.style.background = '#666'}
              onMouseOut={(e) => e.target.style.background = '#444'}
            >
              [ /dev 스탯 관리 ]
            </button>
          </div>
        </aside>

        {/* 메인 작전 화면: Phaser 캔버스 */}
        <main style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', 'justify-content': 'center', 'align-items': 'center' }}>
          <div ref={gameContainer} style={{ width: '800px', height: '600px' }} />
        </main>

        {/* 오른쪽 사이드바 (정보 영역) */}
        <aside style={{ width: '250px', "border-left": '1px solid #0f0', padding: '15px', "background-color": '#000', display: 'flex', 'flex-direction': 'column' }}>
          <h3 style={{ "border-bottom": '1px solid #0f0' }}>SELECTED INFO</h3>
          <div style={{ "margin-top": '10px' }}>
            {agentInfo() ? (
              <div style={{ color: agentInfo().color }}>
                <h4 style={{ margin: '0 0 10px 0', "font-size": '18px' }}>[{agentInfo().name}]</h4>
                <div style={{ "margin-bottom": '5px' }}>▶ HP : {Math.max(0, agentInfo().hp)} / 100</div>
                <div style={{ "margin-bottom": '5px' }}>▶ DM/AS : {agentInfo().damage} / {agentInfo().attackSpeed}ms</div>
                <div style={{ "margin-bottom": '5px' }}>▶ ACCURACY : {agentInfo().accuracy}%</div>
                <div style={{ "margin-bottom": '5px' }}>▶ REACTION : {agentInfo().reactionSpeed}ms</div>
                <div style={{ "margin-bottom": '5px' }}>▶ INT/PERC : {agentInfo().intelligence} / {agentInfo().perception}px</div>
              </div>
            ) : (
              <div style={{ color: '#555' }}>
                <p>대상을 클릭하여<br />세부 능력치를 확인하십시오.</p>
              </div>
            )}
          </div>
        </aside>
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

  return (
    <Show when={!isLoading()} fallback={
      <div style={{ background: '#000', color: '#0f0', height: '100vh', display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center', 'font-family': 'monospace' }}>
        <h1 style={{ 'font-size': '24px', 'margin-bottom': '20px' }}>[ HITMAN OFFICE ]</h1>
        <div style={{ 'font-size': '18px', 'background': '#001100', 'padding': '20px', 'border': '1px solid #0f0' }}>
          SYSTEM INITIALIZING... FETCHING AGENT DATA FROM FIREBASE...
        </div>
      </div>
    }>
      {isDevMode() ? <DevPage /> : renderMainLayout()}
    </Show>
  );
}

export default App;