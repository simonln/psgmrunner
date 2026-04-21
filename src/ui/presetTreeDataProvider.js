"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresetTreeDataProvider = exports.PresetTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class PresetTreeItem extends vscode.TreeItem {
    constructor(preset, isSelected) {
        super(preset.displayName, vscode.TreeItemCollapsibleState.None);
        this.preset = preset;
        this.description = isSelected ? 'Current' : preset.name;
        this.tooltip = [preset.displayName, preset.binaryDir, preset.description].filter(Boolean).join('\n');
        this.contextValue = 'preset';
        this.iconPath = isSelected ? new vscode.ThemeIcon('check') : new vscode.ThemeIcon('gear');
        this.command = {
            command: 'cmakerunner.selectPreset',
            title: 'Select Preset',
            arguments: [this],
        };
    }
}
exports.PresetTreeItem = PresetTreeItem;
class PresetTreeDataProvider {
    constructor() {
        this.onDidChangeTreeDataEmitter = new vscode.EventEmitter();
        this.presets = [];
        this.itemsByPresetName = new Map();
        this.onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
    }
    setPresets(presets, selectedPresetName) {
        this.presets = presets;
        this.selectedPresetName = selectedPresetName;
        this.itemsByPresetName = new Map(presets.map((preset) => [preset.name, new PresetTreeItem(preset, preset.name === selectedPresetName)]));
        this.onDidChangeTreeDataEmitter.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        return Promise.resolve(this.presets.map((preset) => this.itemsByPresetName.get(preset.name)));
    }
    findItem(presetName) {
        return this.itemsByPresetName.get(presetName);
    }
}
exports.PresetTreeDataProvider = PresetTreeDataProvider;
//# sourceMappingURL=presetTreeDataProvider.js.map
