import bash from '@ast-grep/lang-bash'
import { registerDynamicLanguage, parse, SgNode } from '@ast-grep/napi'
import MagicString from 'magic-string'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

registerDynamicLanguage({ bash })

const command = `cd /Users/arthur-fontaine/Developer/code/github.com/arthur-fontaine/fcose-rs/crates/fcose && FCOSE_DEBUG_TICKS=1 ~/.cargo/bin/cargo test test_fcose_call_graph -- --nocapture 2>&1; echo "exit: $?"`

const sg = parse('bash', command)
const newCommand = new MagicString(command)

class CommandReplacer {
  static run(node: SgNode) {
    if (node.kind() !== 'command') return;

    const { suffix } = this.parseCommand(node);

    if (suffix.length === 0) return;
    
    const correctBinSuffix = this.replaceWithBinName(suffix);

    const rewrittenCommand = this.rewriteRtk(correctBinSuffix);

    const start = suffix[0]!.range().start.index;
    const end = suffix[suffix.length - 1]!.range().end.index;

    newCommand.update(start, end, rewrittenCommand);
  }

  static replaceWithBinName(commandChildren: SgNode[]) {
    const commandNameNode = commandChildren[0];
    if (!commandNameNode || commandNameNode.kind() !== 'command_name')
      return commandChildren;

    const commandPath = this.tildeExpand(commandNameNode.text());
    const probableBinName = path.basename(commandPath);
    try {
      const whichResult = this.tildeExpand(spawnSync('which', [probableBinName], { encoding: 'utf-8' }).stdout.trim());
      if (whichResult !== commandPath) return commandChildren;
    } catch {
      return commandChildren;
    }

    return [
      probableBinName,
      ...commandChildren.slice(1),
    ];
  }

  static tildeExpand(path: string) {
    return path.replace(/^~(?=$|\/|\\)/, os.homedir());
  }

  static rewriteRtk(commandChildren: (string | SgNode)[]) {
    const commandStr = this.childrenToString(commandChildren);
    const rewrittenCommand = spawnSync('rtk', ['rewrite', commandStr], { encoding: 'utf-8' }).stdout.trim();
    return rewrittenCommand || commandStr;
  }

  static parseCommand(node: SgNode) {
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

  static childrenToString(children: (string | SgNode)[]) {
    return children.map(child => typeof child === 'string' ? child : child.text()).join(' ');
  }
}

function rtkify(node: SgNode) {
  CommandReplacer.run(node);
  node.children().forEach(rtkify)
}

rtkify(sg.root())

console.log(newCommand.toString())

process.exit(0)
