const maxThreads = globalThis.navigator?.hardwareConcurrency || 8

export const SETTINGS_GROUPS = {
  game: [
    {
      title: 'Game',
      settings: [
        { key: 'enabled', label: 'Enabled', type: 'toggle' },
        { key: 'depth', label: 'Depth', type: 'range', min: 10, max: 30 },
        {
          key: 'renderMode', label: 'Render mode', type: 'choice', options: [
            { value: 'overlay', label: 'Overlay' },
            { value: 'browser', label: 'In-page' },
            { value: 'electron', label: 'App' },
          ],
        },
        {
          key: 'playerColor', label: 'Player color', type: 'choice', options: [
            { value: 'auto', label: 'Auto' },
            { value: 'white', label: 'White' },
            { value: 'black', label: 'Black' },
          ],
        },
      ],
    },
    {
      title: 'Arrows',
      settings: [
        { key: 'showBestMove', label: 'Show best move', type: 'toggle' },
        { key: 'showOpponentBestMove', label: "Opponent's best move", type: 'toggle' },
        { key: 'showAltArrows', label: 'Alternative arrows', type: 'toggle' },
      ],
    },
  ],
  engine: [
    {
      title: 'Engine',
      settings: [
        { key: 'skillLevel', label: 'Skill Level', type: 'range', min: 1, max: 20 },
        {
          key: 'limitStrength', label: 'Limit Strength', type: 'toggle',
          describeValue: value => value ? 'on — ELO governs strength' : 'off — full strength / skill level',
        },
        { key: 'elo', label: 'ELO', type: 'range', min: 1320, max: 3190, step: 10, disabledWhen: s => !s.limitStrength },
        { key: 'threads', label: 'Threads', type: 'range', min: 1, max: maxThreads },
        { key: 'hash', label: 'Hash (MB)', type: 'range', min: 128, max: 2048, step: 128 },
      ],
    },
  ],
}

export const SETTING_SHORTCUTS = Object.entries(SETTINGS_GROUPS).flatMap(([scope, groups]) =>
  groups.flatMap(({ settings }) => settings.map(setting => ({ ...setting, scope, id: `${scope}.${setting.key}` })))
)

export function formatSettingValue(setting, value) {
  if (!Number.isFinite(value)) return undefined
  const number = setting.decimals === undefined ? value : value.toFixed(setting.decimals)
  return `${number}${setting.suffix ?? ''}`
}
