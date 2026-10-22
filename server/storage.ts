import fs from 'node:fs'
import path from 'node:path'

export function initializeStorage(root = process.cwd()): void {
  for (const directory of ['avatars', 'data', 'uploads']) {
    fs.mkdirSync(path.join(root, directory), { recursive: true })
  }

  const avatars = path.join(root, 'avatars')
  if (fs.readdirSync(avatars).length !== 0) return

  const examples = path.join(root, 'examples', 'avatars')
  for (const file of fs.readdirSync(examples)) {
    fs.copyFileSync(path.join(examples, file), path.join(avatars, file), fs.constants.COPYFILE_EXCL)
  }
}
