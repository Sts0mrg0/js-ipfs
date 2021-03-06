'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const log = require('debug')('ipfs:cli:utils')
const Progress = require('progress')
const byteman = require('byteman')
const IPFS = require('ipfs-core')

const getRepoPath = () => {
  return process.env.IPFS_PATH || path.join(os.homedir(), '/.jsipfs')
}

const isDaemonOn = () => {
  try {
    fs.readFileSync(path.join(getRepoPath(), 'api'))
    log('daemon is on')
    return true
  } catch (err) {
    log('daemon is off')
    return false
  }
}

let visible = true
const disablePrinting = () => { visible = false }

/**
 *
 * @param {string} msg
 * @param {boolean} [includeNewline=true]
 * @param {boolean} [isError=false]
 */
const print = (msg, includeNewline = true, isError = false) => {
  if (visible) {
    if (msg === undefined) {
      msg = ''
    }
    msg = includeNewline ? msg + '\n' : msg
    const outStream = isError ? process.stderr : process.stdout
    outStream.write(msg)
  }
}

print.clearLine = () => {
  return process.stdout.clearLine(0)
}

print.cursorTo = (pos) => {
  process.stdout.cursorTo(pos)
}

/**
 * Write data directly to stdout
 *
 * @param {string|Uint8Array} data
 */
print.write = (data) => {
  process.stdout.write(data)
}

/**
 * Print an error message
 *
 * @param {string} msg
 * @param {boolean} [newline=true]
 */
print.error = (msg, newline = true) => {
  print(msg, newline, true)
}

// used by ipfs.add to interrupt the progress bar
print.isTTY = process.stdout.isTTY
print.columns = process.stdout.columns

const createProgressBar = (totalBytes, output) => {
  const total = byteman(totalBytes, 2, 'MB')
  const barFormat = `:progress / ${total} [:bar] :percent :etas`

  // 16 MB / 34 MB [===========             ] 48% 5.8s //
  return new Progress(barFormat, {
    incomplete: ' ',
    clear: true,
    stream: output,
    total: totalBytes
  })
}

const rightpad = (val, n) => {
  let result = String(val)
  for (let i = result.length; i < n; ++i) {
    result += ' '
  }
  return result
}

const ipfsPathHelp = 'ipfs uses a repository in the local file system. By default, the repo is ' +
  'located at ~/.jsipfs. To change the repo location, set the $IPFS_PATH environment variable:\n\n' +
  'export IPFS_PATH=/path/to/ipfsrepo\n'

async function getIpfs (argv) {
  if (!argv.api && !isDaemonOn()) {
    const ipfs = await IPFS.create({
      silent: argv.silent,
      repoAutoMigrate: argv.migrate,
      repo: getRepoPath(),
      init: { allowNew: false },
      start: false,
      pass: argv.pass
    })

    return {
      isDaemon: false,
      ipfs,
      cleanup: async () => {
        await ipfs.stop()
      }
    }
  }

  let endpoint = null
  if (!argv.api) {
    const apiPath = path.join(getRepoPath(), 'api')
    endpoint = fs.readFileSync(apiPath).toString()
  } else {
    endpoint = argv.api
  }
  // Required inline to reduce startup time
  const APIctl = require('ipfs-http-client')
  return {
    isDaemon: true,
    ipfs: APIctl(endpoint),
    cleanup: async () => { }
  }
}

const asBoolean = (value) => {
  if (value === false || value === true) {
    return value
  }

  if (value === undefined) {
    return true
  }

  return false
}

const asOctal = (value) => {
  return parseInt(value, 8)
}

const asMtimeFromSeconds = (secs, nsecs) => {
  if (secs === null || secs === undefined) {
    return undefined
  }

  const output = {
    secs
  }

  if (nsecs !== null && nsecs !== undefined) {
    output.nsecs = nsecs
  }

  return output
}

const coerceMtime = (value) => {
  value = parseInt(value)

  if (isNaN(value)) {
    throw new Error('mtime must be a number')
  }

  return value
}

const coerceMtimeNsecs = (value) => {
  value = parseInt(value)

  if (isNaN(value)) {
    throw new Error('mtime-nsecs must be a number')
  }

  if (value < 0 || value > 999999999) {
    throw new Error('mtime-nsecs must be in the range [0,999999999]')
  }

  return value
}

module.exports = {
  getIpfs,
  isDaemonOn,
  getRepoPath,
  disablePrinting,
  print,
  createProgressBar,
  rightpad,
  ipfsPathHelp,
  asBoolean,
  asOctal,
  asMtimeFromSeconds,
  coerceMtime,
  coerceMtimeNsecs
}
