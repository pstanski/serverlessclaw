import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const dir = path.join(process.cwd(), 'tmp-zip-test');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir);

  console.log('Creating a zip file...');
  const zip = new AdmZip();
  zip.addFile('test.txt', Buffer.from('hello zip file'));
  const zipPath = path.join(dir, 'test.zip');
  zip.writeZip(zipPath);

  console.log('Extracting zip file...');
  const extDir = path.join(dir, 'extracted');
  const zipToExtract = new AdmZip(zipPath);
  zipToExtract.extractAllTo(extDir, true);

  console.log('Extracted files:', fs.readdirSync(extDir));
  console.log('Content of test.txt:', fs.readFileSync(path.join(extDir, 'test.txt'), 'utf8'));

  console.log('Creating new zip from folder...');
  const newZip = new AdmZip();
  newZip.addLocalFolder(extDir);
  const buffer = newZip.toBuffer();
  console.log('Created zip buffer of size:', buffer.length);
}

main().catch(console.error);
