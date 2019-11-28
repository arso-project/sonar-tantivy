const fs = require('fs')
const chalk = require('chalk')
const makeClient = require('../client')
const pretty = require('pretty-bytes')
const table = require('text-table')
const date = require('date-fns')

exports.command = 'fs <command>'
exports.describe = 'file system'
exports.builder = function (yargs) {
  yargs
    .command({
      command: 'read <path>',
      describe: 'read file to stdout',
      handler: readfile
    })
    .command({
      command: 'write <path>',
      describe: 'write file from stdin',
      handler: writefile
    })
    .command({
      command: 'ls [path]',
      describe: 'list dir',
      builder: {
        list: {
          alias: 'l',
          boolean: true,
          describe: 'list mode'
        }
      },
      handler: ls
    })
    .command({
      command: 'import [path]',
      describe: 'import a file or folder',
      handler: importfile
    })
}

async function ls (argv) {
  const client = makeClient(argv)
  const path = argv.path || '/'
  const list = await client.readdir(path)
  const formatted = formatStat(list, argv)
  console.log(formatted)
}

async function readfile (argv) {
  const client = makeClient(argv)
  const path = argv.path
  const res = await client.readFile(path)
  res.pipe(process.stdout)
}

async function writefile (argv) {
  console.log(argv)
  const client = makeClient(argv)
  const path = argv.path
  const res = await client.writeFile(path, process.stdin)
  console.log(res)
}

function importfile (argv) {
  console.log(argv)
}

function formatStat (files, opts = {}) {
  opts = {
    list: false,
    ...opts
  }
  const rows = files.map(file => {
    const stat = parseStat(file)
    let { name } = file
    if (stat.isDirectory()) file.name = chalk.bold.blueBright(name)
    else file.name = name
    file.size = pretty(file.size)
    file.mtime = formatDate(stat.mtime)
    return file
  })

  if (!opts.list) {
    return rows.map(f => f.name).join(' ')
  } else {
    const list = table(rows.map(f => ([f.size, f.mtime, f.name])))
    return `total ${rows.length}\n${list}`
  }
}

function formatDate (d) {
  if (date.differenceInYears(new Date(), d)) {
    return date.format(d, 'dd. MMM yyyy')
  } else {
    return date.format(d, 'dd. MMM HH:mm')
  }
}

function parseStat (s) {
  const { Stats } = require('fs')
  return new Stats(s.dev, s.mode, s.nlink, s.uid, s.gid, s.rdev, s.blksize,
    s.ino, s.size, s.blocks, s.atime, s.mtime, s.ctime)
}