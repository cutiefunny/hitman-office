import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const DEFAULT_KILLERS = [
    {
        "id": 1,
        "name": "KILLER 1",
        "color": 65280,
        "hp": 100,
        "stats": {
            "damage": 100,
            "attackSpeed": 800,
            "accuracy": 80,
            "reactionSpeed": 300,
            "intelligence": 50,
            "perception": 250
        },
        "attackType": "ranged",
        "range": 150,
        "specialAbilities": ["은신"]
    },
    {
        "id": 2,
        "name": "KILLER 2",
        "color": 65535,
        "hp": 100,
        "stats": {
            "damage": 30,
            "attackSpeed": 400,
            "accuracy": 100,
            "reactionSpeed": 200,
            "intelligence": 40,
            "perception": 200
        },
        "attackType": "melee",
        "range": 50,
        "specialAbilities": ["불굴"]
    }
];

export const DEFAULT_TARGET = {
    "hp": 100,
    "stats": {
        "damage": 100,
        "attackSpeed": 800,
        "accuracy": 100,
        "reactionSpeed": 500,
        "intelligence": 80,
        "perception": 300
    }
};

let cachedKillers = null;
let cachedTarget = null;

export async function loadConfig() {
    try {
        const docRef = doc(db, "agent_stats", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            cachedKillers = data.killers;
            cachedTarget = data.target;
        } else {
            console.log("No such document! Using defaults.");
            cachedKillers = DEFAULT_KILLERS;
            cachedTarget = DEFAULT_TARGET;
        }
    } catch (e) {
        console.error("Error loading config from Firebase:", e);
        cachedKillers = DEFAULT_KILLERS;
        cachedTarget = DEFAULT_TARGET;
    }
}

export function getKillers() {
    return cachedKillers || DEFAULT_KILLERS;
}

export function getTargetConfig() {
    return cachedTarget || DEFAULT_TARGET;
}

export async function saveAllConfig(killers, target) {
    try {
        const docRef = doc(db, "agent_stats", "config");
        await setDoc(docRef, { killers, target });
        cachedKillers = killers;
        cachedTarget = target;
        console.log("Config saved to Firebase.");
    } catch (e) {
        console.error("Error saving config to Firebase:", e);
        throw e;
    }
}
