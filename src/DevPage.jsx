import { createSignal, Index, Show } from 'solid-js';
import { getKillers, getTargetConfig, saveAllConfig } from './data/AgentConfig';

export default function DevPage() {
    const [killers, setKillers] = createSignal(getKillers());
    const [target, setTarget] = createSignal(getTargetConfig());
    const [isSaving, setIsSaving] = createSignal(false);
    const [selectedCategory, setSelectedCategory] = createSignal('AGENT');
    const [selectedIndex, setSelectedIndex] = createSignal(0);

    const updateKillerProp = (index, field, value) => {
        setKillers(prev => {
            const newList = [...prev];
            const item = { ...newList[index] };
            if (field === 'specialAbilities') {
                const currentAbilities = item.specialAbilities || [];
                if (currentAbilities.includes(value)) {
                    item.specialAbilities = currentAbilities.filter(a => a !== value);
                } else {
                    item.specialAbilities = [...currentAbilities, value];
                }
            } else if (field in item.stats) {
                const val = parseInt(value, 10);
                if (!isNaN(val)) item.stats = { ...item.stats, [field]: val };
            } else if (field === 'name' || field === 'attackType') {
                item[field] = value;
            } else {
                const val = parseInt(value, 10);
                if (!isNaN(val)) item[field] = val;
            }
            newList[index] = item;
            return newList;
        });
    };

    const updateTargetStat = (field, value) => {
        setTarget(prev => {
            const newTarget = { ...prev };
            if (field in newTarget.stats) {
                const val = parseInt(value, 10);
                if (!isNaN(val)) newTarget.stats = { ...newTarget.stats, [field]: val };
            } else {
                const val = parseInt(value, 10);
                if (!isNaN(val)) newTarget[field] = val;
            }
            return newTarget;
        });
    };

    const addNewKiller = () => {
        const newKillers = [...killers()];
        const newId = Date.now();
        newKillers.push({
            id: newId,
            name: `신규 요원 ${newKillers.length + 1}`,
            color: 0x1a73e8,
            hp: 100,
            stats: { damage: 50, attackSpeed: 800, accuracy: 80, reactionSpeed: 300, intelligence: 50, perception: 250 },
            attackType: 'ranged',
            range: 150,
            specialAbilities: []
        });
        setKillers(newKillers);
        setSelectedIndex(newKillers.length - 1);
    };

    const deleteKiller = (index) => {
        if (killers().length <= 1) return;
        if (confirm("정말 삭제하시겠습니까?")) {
            const newList = killers().filter((_, i) => i !== index);
            setKillers(newList);
            setSelectedIndex(0);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await saveAllConfig(killers(), target());
            alert("저장되었습니다.");
            setIsSaving(false);
        } catch (e) {
            alert("저장 오류 발생");
            setIsSaving(false);
        }
    };

    return (
        <div id="gmail-dev-root">
            <style>{`
                #gmail-dev-root {
                    position: fixed !important; top: 0 !important; left: 0 !important; 
                    width: 100vw !important; height: 100vh !important;
                    background-color: #f6f8fc !important; color: #202124 !important;
                    display: flex !important; flex-direction: column !important;
                    z-index: 999999 !important; font-family: 'Roboto', sans-serif !important;
                    box-sizing: border-box !important;
                }
                #gmail-dev-root * { box-sizing: border-box !important; }
                
                .dev-header {
                    height: 64px !important; flex-shrink: 0 !important;
                    display: flex !important; align-items: center !important;
                    padding: 0 20px !important; border-bottom: 1px solid #dadce0 !important;
                    background-color: #f6f8fc !important;
                }
                .dev-content {
                    flex: 1 !important; display: flex !important; overflow: hidden !important;
                }
                .dev-sidebar {
                    width: 256px !important; flex-shrink: 0 !important;
                    background-color: #f6f8fc !important; padding-top: 8px !important;
                    border-right: 1px solid #dadce0 !important;
                }
                .dev-list {
                    width: 400px !important; flex-shrink: 0 !important;
                    background-color: #ffffff !important; border-right: 1px solid #dadce0 !important;
                    display: flex !important; flex-direction: column !important;
                }
                .dev-detail {
                    flex: 1 !important; background-color: #ffffff !important;
                    overflow-y: auto !important; padding: 40px !important;
                }

                .compose-btn {
                    margin: 8px 16px 20px 16px !important; padding: 16px 24px !important;
                    background-color: #c2e7ff !important; border: none !important;
                    border-radius: 16px !important; cursor: pointer !important;
                    display: flex !important; align-items: center !important; gap: 12px !important;
                    box-shadow: 0 1px 3px rgba(60,64,67,0.3) !important;
                }
                .nav-item {
                    display: flex !important; align-items: center !important;
                    padding: 10px 24px !important; margin-right: 12px !important;
                    border-radius: 0 24px 24px 0 !important; cursor: pointer !important;
                    color: #444746 !important; font-size: 14px !important;
                }
                .nav-item.active {
                    background-color: #e8f0fe !important; color: #1967d2 !important; font-weight: bold !important;
                }
                .list-item {
                    padding: 12px 20px !important; cursor: pointer !important;
                    display: flex !important; align-items: center !important; gap: 15px !important;
                    border-bottom: 1px solid #f6f8fc !important;
                }
                .list-item.active { background-color: #e8f0fe !important; }

                .stat-input {
                    padding: 10px !important; border: 1px solid #dadce0 !important;
                    border-radius: 4px !important; width: 100% !important; outline: none !important;
                }
                .stat-input:focus { border-color: #1a73e8 !important; }
            `}</style>

            <header class="dev-header">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 24px; cursor: pointer;">☰</span>
                    <div style="display: flex; align-items: center; gap: 8px;" onClick={() => window.location.hash = ''}>
                        <div style="width: 32px; height: 32px; background: #1a73e8; border-radius: 4px;"></div>
                        <span style="font-size: 22px; color: #5f6368;">Hitman <span style="font-weight: bold;">Dev</span></span>
                    </div>
                </div>
                <div style="flex: 1; max-width: 720px; margin: 0 40px;">
                    <div style="background: #eef3f8; border-radius: 8px; padding: 10px 16px; color: #5f6368;">검색...</div>
                </div>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <button onClick={handleSave} style="background: #c2e7ff; color: #001d35; border: none; border-radius: 24px; padding: 12px 24px; font-weight: bold; cursor: pointer;">
                        {isSaving() ? '저장 중...' : '저장하기'}
                    </button>
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #5f6368; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px;">ADM</div>
                </div>
            </header>

            <div class="dev-content">
                <nav class="dev-sidebar">
                    <button class="compose-btn" onClick={addNewKiller}>
                        <span style="font-size: 24px; color: #ea4335;">+</span>
                        <span style="font-weight: 500;">새 요원 추가</span>
                    </button>
                    <div class={`nav-item ${selectedCategory() === 'AGENT' ? 'active' : ''}`} onClick={() => { setSelectedCategory('AGENT'); setSelectedIndex(0); }}>
                        <span style="margin-right: 15px;">👥</span> 요원 관리
                    </div>
                    <div class={`nav-item ${selectedCategory() === 'TARGET' ? 'active' : ''}`} onClick={() => { setSelectedCategory('TARGET'); setSelectedIndex(0); }}>
                        <span style="margin-right: 15px;">🎯</span> 타겟 설정
                    </div>
                    <div class={`nav-item ${selectedCategory() === 'SYSTEM' ? 'active' : ''}`} onClick={() => { setSelectedCategory('SYSTEM'); setSelectedIndex(0); }}>
                        <span style="margin-right: 15px;">⚙️</span> 시스템 설정
                    </div>
                </nav>

                <div class="dev-list">
                    <div style="padding: 16px 20px; border-bottom: 1px solid #f6f8fc; font-weight: 500; color: #5f6368;">항목 목록</div>
                    <div style="flex: 1; overflow-y: auto;">
                        <Show when={selectedCategory() === 'AGENT'}>
                            <Index each={killers()}>{(k, i) => (
                                <div class={`list-item ${selectedIndex() === i ? 'active' : ''}`} onClick={() => setSelectedIndex(i)}>
                                    <div style={`width: 32px; height: 32px; border-radius: 50%; background: #${k().color.toString(16).padStart(6, '0')}; opacity: 0.2; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;`}>
                                        {k().name.charAt(0)}
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="display: flex; justify-content: space-between;">
                                            <span style="font-size: 14px; font-weight: 500;">{k().name}</span>
                                            <span style="font-size: 11px; color: #5f6368;">ID: {k().id}</span>
                                        </div>
                                        <div style="font-size: 12px; color: #5f6368;">{k().attackType === 'ranged' ? '원거리' : '근접'} | HP {k().hp}</div>
                                    </div>
                                    {selectedIndex() === i && <span onClick={(e) => { e.stopPropagation(); deleteKiller(i); }} style="color: #d93025; cursor: pointer;">🗑️</span>}
                                </div>
                            )}</Index>
                        </Show>
                        <Show when={selectedCategory() === 'TARGET'}>
                            <div class="list-item active">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #f28b82; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: bold;">T</div>
                                <span>Main Target</span>
                            </div>
                        </Show>
                    </div>
                </div>

                <main class="dev-detail">
                    <Show when={selectedCategory() === 'AGENT' && killers()[selectedIndex()]}>
                        <div style="max-width: 800px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px;">
                                <h2 style="margin: 0; font-size: 24px; font-weight: 400;">요원 프로필</h2>
                                <div style="display: flex; gap: 20px; color: #5f6368; font-size: 20px;">
                                    <span>📁</span><span>⭐</span><span onClick={() => deleteKiller(selectedIndex())} style="cursor: pointer;">🗑️</span>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px;">
                                <div>
                                    <div style="margin-bottom: 24px;">
                                        <label style="font-size: 12px; font-weight: bold; color: #5f6368; display: block; margin-bottom: 8px;">Agent Designation</label>
                                        <input class="stat-input" value={killers()[selectedIndex()].name} onInput={(e) => updateKillerProp(selectedIndex(), 'name', e.target.value)} />
                                    </div>
                                    <div style="margin-bottom: 24px;">
                                        <label style="font-size: 12px; font-weight: bold; color: #5f6368; display: block; margin-bottom: 8px;">Weaponry Case</label>
                                        <select class="stat-input" value={killers()[selectedIndex()].attackType} onChange={(e) => updateKillerProp(selectedIndex(), 'attackType', e.target.value)}>
                                            <option value="ranged">원거리 사격 형</option>
                                            <option value="melee">근접 격투 형</option>
                                        </select>
                                    </div>
                                    <h4 style="font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-top: 40px;">Core Stats</h4>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                                        <div>
                                            <label style="font-size: 11px; color: #5f6368;">체력(HP)</label>
                                            <input type="number" class="stat-input" value={killers()[selectedIndex()].hp} onInput={(e) => updateKillerProp(selectedIndex(), 'hp', e.target.value)} />
                                        </div>
                                        {Object.keys(killers()[selectedIndex()].stats).map(key => (
                                            <div>
                                                <label style="font-size: 11px; color: #5f6368;">{key.toUpperCase()}</label>
                                                <input type="number" class="stat-input" value={killers()[selectedIndex()].stats[key]} onInput={(e) => updateKillerProp(selectedIndex(), key, e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style="border-left: 1px solid #eee; padding-left: 40px;">
                                    <h4 style="font-size: 14px; margin-bottom: 20px;">Tactical Abilities</h4>
                                    {['불굴', '은신', '대시'].map(ability => (
                                        <div onClick={() => updateKillerProp(selectedIndex(), 'specialAbilities', ability)}
                                            style={`padding: 12px; border: 1px solid ${(killers()[selectedIndex()].specialAbilities || []).includes(ability) ? '#1a73e8' : '#dadce0'}; 
                                                    border-radius: 8px; margin-bottom: 12px; cursor: pointer; display: flex; align-items: center; gap: 12px;
                                                    background-color: ${(killers()[selectedIndex()].specialAbilities || []).includes(ability) ? '#e8f0fe' : 'transparent'};`}>
                                            <div style={`width: 18px; height: 18px; border: 2px solid #747775; display: flex; align-items: center; justify-content: center;`}>
                                                {(killers()[selectedIndex()].specialAbilities || []).includes(ability) && <div style="width: 10px; height: 10px; background: #1a73e8;"></div>}
                                            </div>
                                            <span style="font-size: 14px;">{ability}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Show>
                    <Show when={selectedCategory() === 'TARGET'}>
                        <div style="max-width: 600px;">
                            <h2 style="font-size: 24px; font-weight: 400; margin-bottom: 32px;">Target Data Control</h2>
                            <div style="margin-bottom: 20px;">
                                <label style="font-size: 12px; color: #5f6368;">기본 내구도 (HP)</label>
                                <input type="number" class="stat-input" value={target().hp} onInput={(e) => updateTargetStat('hp', e.target.value)} />
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                                {Object.keys(target().stats).map(key => (
                                    <div>
                                        <label style="font-size: 11px; color: #5f6368;">{key.toUpperCase()}</label>
                                        <input type="number" class="stat-input" value={target().stats[key]} onInput={(e) => updateTargetStat(key, e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Show>
                    <Show when={selectedCategory() === 'SYSTEM'}>
                        <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: #5f6368;">
                            시스템 설정 모듈 대기 중...
                        </div>
                    </Show>
                </main>
            </div>
        </div>
    );
}

