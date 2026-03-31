import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

import bash from '@ast-grep/lang-bash'
import { registerDynamicLanguage, parse, SgNode } from '@ast-grep/napi'
import MagicString from 'magic-string'

registerDynamicLanguage({ bash })

class Rtkify {
  private ms: MagicString;

  constructor(newCommand: MagicString) {
    this.ms = newCommand;
  }

  static run(node: SgNode) {
    const newCommand = new MagicString(node.text());
    const rtkifyInstance = new Rtkify(newCommand);
    return rtkifyInstance.run(node);
  }

  private run(node: SgNode) {
    exploreCommand: {
      if (node.kind() !== 'command') break exploreCommand;

      const { suffix } = Rtkify.parseCommand(node);

      if (suffix.length === 0) break exploreCommand;

      const correctBinSuffix = Rtkify.replaceWithBinName(suffix);

      const rewrittenCommand = Rtkify.rewriteRtk(correctBinSuffix);

      const start = suffix[0]!.range().start.index;
      const end = suffix[suffix.length - 1]!.range().end.index;

      this.ms.update(start, end, rewrittenCommand);
    }

    node.children().forEach(child => this.run(child));

    return this.ms.toString();
  }

  private static parseCommand(node: SgNode) {
    const children = node.children();

    const prefix: SgNode[] = [];
    const suffix: SgNode[] = [];
    let commandName: SgNode | null = null;

    for (const child of children) {
      if (child.kind() === 'command_name' && !commandName) {
        commandName = child;
      }

      if (!commandName) {
        prefix.push(child);
      } else {
        suffix.push(child);
      }
    }

    return { prefix, suffix };
  }

  private static replaceWithBinName(commandChildren: SgNode[]) {
    const commandNameNode = commandChildren[0];
    if (!commandNameNode || commandNameNode.kind() !== 'command_name')
      return commandChildren;

    const commandPath = this.tildeExpand(commandNameNode.text());
    const probableBinName = path.basename(commandPath);

    const whichResult = spawnSync('which', [probableBinName], { encoding: 'utf-8' });
    if (whichResult.status !== 0) return commandChildren;
    const whichPath = this.tildeExpand(whichResult.stdout.trim());
    if (whichPath !== commandPath) return commandChildren;

    return [
      probableBinName,
      ...commandChildren.slice(1),
    ];
  }

  private static rewriteRtk(commandChildren: (string | SgNode)[]) {
    const commandStr = this.childrenToString(commandChildren);

    const rewrittenCommandResult = spawnSync('rtk', ['rewrite', commandStr], { encoding: 'utf-8' });

    if (rewrittenCommandResult.status !== 0) return commandStr;

    const rewrittenCommand = rewrittenCommandResult.stdout.trim();
    return rewrittenCommand || commandStr;
  }

  private static childrenToString(children: (string | SgNode)[]) {
    return children.map(child => typeof child === 'string' ? child : child.text()).join(' ');
  }

  private static tildeExpand(p: string) {
    return p.replace(/^~(?=$|\/|\\)/, os.homedir());
  }
}

function rtkify(command: string) {
  const sg = parse('bash', command);
  return Rtkify.run(sg.root());
}

export { rtkify }

{
  // CLI usage

  const isMain = (() => {
    if (typeof require !== 'undefined' && require.main) {
      return require.main === module;
    } else if (typeof module !== 'undefined') {
      return module === (globalThis as any).module;
    } else {
      // @ts-expect-error import.meta is only available in ES modules
      const currentFile = fileURLToPath(import.meta.url);
      const entryFile = process.argv[1] && path.resolve(process.argv[1]);
      return currentFile === entryFile;
    }
  })();

  if (isMain) {
    const command = process.argv[2];
    if (command) {
      console.log(rtkify(command));
    } else {
      console.error(`Usage: ${path.basename(process.argv[1] || 'index.js')} "<command to rtkify>"`);
      process.exit(1);
    }
  }
}
