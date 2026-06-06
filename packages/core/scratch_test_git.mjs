/* global process, console */
import * as git from 'isomorphic-git';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const dir = path.join(process.cwd(), 'tmp-git-test');
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir);

  console.log('Initializing git in', dir);
  await git.init({ fs, dir });

  console.log('Creating a file...');
  fs.writeFileSync(path.join(dir, 'hello.txt'), 'hello world');

  console.log('Adding file...');
  await git.add({ fs, dir, filepath: 'hello.txt' });

  console.log('Committing...');
  await git.commit({
    fs,
    dir,
    author: { name: 'Test', email: 'test@example.com' },
    message: 'initial commit',
  });

  console.log('Branches before:', await git.listBranches({ fs, dir }));

  console.log('Creating and checking out main branch...');
  await git.branch({ fs, dir, ref: 'main' });
  await git.checkout({ fs, dir, ref: 'main' });

  console.log('Branches after:', await git.listBranches({ fs, dir }));
  console.log('Current branch (HEAD):', await git.currentBranch({ fs, dir }));
}

main().catch(console.error);
