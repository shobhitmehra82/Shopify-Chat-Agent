const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

const threshold = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info

function emit(level, message, meta) {
  if (LEVELS[level] > threshold) return
  const stamp = new Date().toISOString()
  const suffix = meta === undefined ? '' : ` ${JSON.stringify(meta)}`
  const line = `${stamp} ${level.toUpperCase().padEnd(5)} ${message}${suffix}`
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
}
