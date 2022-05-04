import { existsSync, readFileSync, writeFileSync } from 'fs';

export function loadJSONFile(path) {
    const rawData = readFileSync(path);
    const data = JSON.parse(rawData);
    return data;
}

export function writeJSONFile(path, data) {
    const parsedData = JSON.stringify(data);
    writeFileSync(path, parsedData);
}

export function checkExistingFile(path) {
    return existsSync(path);
}
