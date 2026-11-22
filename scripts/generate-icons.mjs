import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const source = resolve(root, 'logo.png')
const pngOutput = resolve(root, 'build/chess-topper-icon.png')
const icoOutput = resolve(root, 'build/chess-topper-icon.ico')

await mkdir(resolve(root, 'build'), { recursive: true })
const sourceBytes = await readFile(source)
const png = await sharp(sourceBytes)
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer()
await writeFile(pngOutput, png)

// Windows ICO with an embedded 256x256 PNG image.
const icoImage = await sharp(png).resize(256, 256, { fit: 'contain' }).png().toBuffer()
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0)       // reserved
header.writeUInt16LE(1, 2)       // image type: ICO
header.writeUInt16LE(1, 4)       // image count
header.writeUInt8(0, 6)          // 256 px width
header.writeUInt8(0, 7)          // 256 px height
header.writeUInt8(0, 8)          // palette
header.writeUInt8(0, 9)          // reserved
header.writeUInt16LE(1, 10)      // color planes
header.writeUInt16LE(32, 12)     // bits per pixel
header.writeUInt32LE(icoImage.length, 14)
header.writeUInt32LE(22, 18)
await writeFile(icoOutput, Buffer.concat([header, icoImage]))

console.log(`Generated app icons from repository logo.png: ${pngOutput} and ${icoOutput}`)
