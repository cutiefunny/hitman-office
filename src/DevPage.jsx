import { createSignal, For } from 'solid-js';
import { getKillers, getTargetConfig, saveAllConfig, DEFAULT_KILLERS, DEFAULT_TARGET } from './data/AgentConfig';

export default function DevPage(props) {
    const [killers, setKillers] = createSignal(getKillers());
    const [target, setTarget] = createSignal(getTargetConfig());
    const [isSaving, setIsSaving] = createSignal(false);

    const updateKillerStat = (index, field, value) => {
        const newKillers = JSON.parse(JSON.stringify(killers())); // Deep copy

        const val = parseInt(value, 10);
        if (isNaN(val)) return;

        if (field in newKillers[index].stats) {
            newKillers[index].stats[field] = val;
        } else {
            newKillers[index][field] = val;
        }
        setKillers(newKillers);
    };

    const updateTargetStat = (field, value) => {
        const newTarget = JSON.parse(JSON.stringify(target()));

        const val = parseInt(value, 10);
        if (isNaN(val)) return;

        if (field in newTarget.stats) {
            newTarget.stats[field] = val;
        } else {
            newTarget[field] = val;
        }
        setTarget(newTarget);
    };

    const addNewKiller = () => {
        const newKillers = [...killers()];
        const newId = newKillers.length + 1;
        newKillers.push({
            id: newId,
            name: `KILLER ${newId}`,
            color: 0xffffff,
            hp: 100,
            stats: { damage: 50, attackSpeed: 600, accuracy: 90, reactionSpeed: 400, intelligence: 50, perception: 200 },
            attackType: 'ranged',
            range: 150
        });
        setKillers(newKillers);
        alert(`신규 캐릭터 ${newId}가 추가되었습니다. '설정 적용' 시 영구 저장됩니다.`);
    };

    const resetToDefaults = () => {
        if (confirm("기본 초기값으로 돌아가시겠습니까? '설정 적용'을 눌러야 실제 파일에 반영됩니다.")) {
            setKillers(DEFAULT_KILLERS);
            setTarget(DEFAULT_TARGET);
        }
    };

    const handleBack = async () => {
        setIsSaving(true);
        try {
            await saveAllConfig(killers(), target());
            // 약간의 지연을 주어 유저가 저장 중임을 인지하게 함
            setTimeout(() => {
                window.location.hash = '';
                window.location.reload();
            }, 500);
        } catch (e) {
            alert("저장 중 오류가 발생했습니다.");
            setIsSaving(false);
        }
    };

    const getStatName = (key) => {
        const map = {
            hp: '체력 (HP)',
            damage: '1회 데미지',
            attackSpeed: '공격 속도(ms)',
            accuracy: '명중률(%)',
            reactionSpeed: '반응 속도(ms)',
            intelligence: '지능 (Int)',
            perception: '인지 시야(px)'
        };
        return map[key] || key;
    };

    return (
        <div style={{ flex: 1, padding: '20px', background: '#111', color: '#0f0', "font-family": 'monospace', height: '100%', "overflow-y": 'auto' }}>
            <div style={{ "display": "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": '15px' }}>
                <h2 style={{ margin: 0 }}>[ 시스템 백도어 ] - /dev 엔티티 속성 관리</h2>
                <div>
                    <button onClick={resetToDefaults} style={{ background: '#333', color: '#fff', border: '1px solid #555', padding: '5px 15px', "margin-right": '10px', cursor: 'pointer', 'font-family': 'monospace' }}>전체 초기화</button>
                    <button
                        onClick={handleBack}
                        disabled={isSaving()}
                        style={{ background: isSaving() ? '#222' : '#0f0', color: isSaving() ? '#888' : '#000', border: 'none', padding: '5px 15px', 'font-weight': 'bold', cursor: isSaving() ? 'wait' : 'pointer', 'font-family': 'monospace' }}
                    >
                        {isSaving() ? '[ 동기화 중... ]' : '[ 설정 적용 및 재시작 ]'}
                    </button>
                </div>
            </div>

            <hr style={{ "border-color": '#0f0', "margin-bottom": '20px' }} />

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: 1, padding: '15px', border: '1px solid #444', background: '#000' }}>
                    <h3 style={{ 'border-bottom': '1px solid #f00', color: '#f00' }}>TARGET PROP</h3>
                    <div style={{ "margin-bottom": '10px', display: 'flex', 'align-items': 'center' }}>
                        <label style={{ width: '120px' }}>{getStatName('hp')}</label>
                        <input type="number" value={target().hp} onInput={(e) => updateTargetStat('hp', e.target.value)} style={{ background: '#222', color: '#f00', border: '1px solid #f00', padding: '5px' }} />
                    </div>
                    {Object.keys(target().stats).map(statKey => (
                        <div style={{ "margin-bottom": '10px', display: 'flex', 'align-items': 'center' }}>
                            <label style={{ width: '120px' }}>{getStatName(statKey)}</label>
                            <input type="number" value={target().stats[statKey]} onInput={(e) => updateTargetStat(statKey, e.target.value)} style={{ background: '#222', color: '#f00', border: '1px solid #f00', padding: '5px' }} />
                        </div>
                    ))}
                </div>

                <div style={{ flex: 2, padding: '15px', border: '1px solid #444', background: '#000' }}>
                    <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'border-bottom': '1px solid #0ff', 'margin-bottom': '15px', 'padding-bottom': '5px' }}>
                        <h3 style={{ margin: 0, color: '#0ff' }}>KILLERS PROP</h3>
                        <button onClick={addNewKiller} style={{ background: '#0ff', color: '#000', border: 'none', padding: '2px 10px', cursor: 'pointer', 'font-family': 'monospace', 'font-weight': 'bold' }}>+ 요원 추가</button>
                    </div>
                    <div style={{ display: 'grid', "grid-template-columns": "1fr 1fr", gap: "15px" }}>
                        <For each={killers()}>{(k, index) => (
                            <div style={{ border: '1px dotted #0ff', padding: '15px' }}>
                                <h4 style={{ margin: '0 0 10px 0', color: k.id === 1 ? '#0f0' : '#0ff' }}>{k.name} (무기: {k.attackType})</h4>
                                <div style={{ "margin-bottom": '10px', display: 'flex', 'align-items': 'center' }}>
                                    <label style={{ width: '120px' }}>{getStatName('hp')}</label>
                                    <input type="number" value={k.hp} onInput={(e) => updateKillerStat(index(), 'hp', e.target.value)} style={{ background: '#222', color: '#0ff', border: '1px solid #0ff', padding: '5px' }} />
                                </div>
                                {Object.keys(k.stats).map(statKey => (
                                    <div style={{ "margin-bottom": '10px', display: 'flex', 'align-items': 'center' }}>
                                        <label style={{ width: '120px' }}>{getStatName(statKey)}</label>
                                        <input type="number" value={k.stats[statKey]} onInput={(e) => updateKillerStat(index(), statKey, e.target.value)} style={{ background: '#222', color: '#0ff', border: '1px solid #0ff', padding: '5px' }} />
                                    </div>
                                ))}
                            </div>
                        )}</For>
                    </div>
                </div>
            </div>
        </div>
    );
}
