import { copyFile, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'

const root = process.cwd()
const androidDir = join(root, 'android')
const appId = 'com.officialknightly.chesstopper.mobile'
const packagePath = appId.replaceAll('.', '/')
const javaDir = join(androidDir, 'app', 'src', 'main', 'java', packagePath)
const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml')
const valuesDir = join(androidDir, 'app', 'src', 'main', 'res', 'values')
const xmlDir = join(androidDir, 'app', 'src', 'main', 'res', 'xml')
const drawableDir = join(androidDir, 'app', 'src', 'main', 'res', 'drawable-nodpi')

async function exists(path) {
  try { await access(path); return true } catch { return false }
}

if (!(await exists(androidDir))) {
  console.log('Adding the Capacitor Android platform…')
  execFileSync('npx', ['cap', 'add', 'android'], { cwd: root, stdio: 'inherit' })
}

await Promise.all([mkdir(javaDir, { recursive: true }), mkdir(valuesDir, { recursive: true }), mkdir(xmlDir, { recursive: true }), mkdir(drawableDir, { recursive: true })])

const nativeRoot = join(root, 'native-android')
await copyFile(join(nativeRoot, 'MainActivity.java'), join(javaDir, 'MainActivity.java'))
await copyFile(join(nativeRoot, 'ChessTopperMobilePlugin.java'), join(javaDir, 'ChessTopperMobilePlugin.java'))
await copyFile(join(nativeRoot, 'ChessTopperAccessibilityService.java'), join(javaDir, 'ChessTopperAccessibilityService.java'))
await copyFile(join(nativeRoot, 'chess_topper_accessibility_service.xml'), join(xmlDir, 'chess_topper_accessibility_service.xml'))
await copyFile(join(root, 'logo.png'), join(drawableDir, 'chess_topper_logo.png'))

let manifest = await readFile(manifestPath, 'utf8')
if (!manifest.includes('ChessTopperAccessibilityService')) {
  const queries = `
    <queries>
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>
`
  manifest = manifest.replace('<application', queries + '\n    <application')
  const service = `
        <service
            android:name=".ChessTopperAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true"
            android:label="Chess Topper floating controls">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/chess_topper_accessibility_service" />
        </service>
`
  manifest = manifest.replace('</application>', service + '    </application>')
}
manifest = manifest.replace(/android:icon="[^"]*"/, 'android:icon="@drawable/chess_topper_logo"')
manifest = manifest.replace(/android:roundIcon="[^"]*"/, 'android:roundIcon="@drawable/chess_topper_logo"')
if (!manifest.includes('android:icon=')) {
  manifest = manifest.replace('<application', '<application android:icon="@drawable/chess_topper_logo" android:roundIcon="@drawable/chess_topper_logo"')
}
await writeFile(manifestPath, manifest)

const stringsPath = join(valuesDir, 'strings.xml')
let strings = await readFile(stringsPath, 'utf8').catch(() => '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n</resources>\n')
if (!strings.includes('accessibility_service_description')) {
  strings = strings.replace('</resources>', '    <string name="accessibility_service_description">Detects the selected foreground app so Chess Topper can show its floating quick controls. It does not read screen content or interact with chess moves.</string>\n</resources>')
}
strings = strings.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">Chess Topper</string>')
if (!strings.includes('name="app_name"')) {
  strings = strings.replace('</resources>', '    <string name="app_name">Chess Topper</string>\n</resources>')
}
await writeFile(stringsPath, strings)

console.log('Android project prepared with the Chess Topper native bridge, foreground-app service and knight icon.')
