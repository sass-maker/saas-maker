import { log } from '../lib/ui.js';

const ROOT_COMMANDS = [
  'login',
  'whoami',
  'keys',
  'projects',
  'init',
  'status',
  'doctor',
  'completions',
  'examples',
  'api',
  'help',
];

function detectShell(): string {
  const shell = process.env.SHELL?.split('/').pop();
  if (shell) return shell;
  return 'bash';
}

function bashCompletionScript(): string {
  const root = ROOT_COMMANDS.join(' ');
  return `# fnd bash completion
_fnd_complete() {
  local cur prev cmd
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmd="\${COMP_WORDS[1]}"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${root}" -- "$cur") )
    return 0
  fi

  case "$cmd" in
    projects) COMPREPLY=( $(compgen -W "list create" -- "$cur") ); return 0 ;;
    api)
      if [[ \${COMP_CWORD} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "GET POST PUT PATCH DELETE" -- "$cur") )
        return 0
      fi
      ;;
  esac
}
complete -F _fnd_complete fnd
`;
}

function zshCompletionScript(): string {
  return `#compdef fnd
_fnd_complete() {
  local -a commands
  commands=(
    "login"
    "whoami"
    "keys"
    "projects"
    "init"
    "status"
    "doctor"
    "completions"
    "examples"
    "api"
    "help"
  )

  if (( CURRENT == 2 )); then
    _describe 'command' commands
    return
  fi

  case "$words[2]" in
    projects) _values 'project commands' list create ;;
    api) _values 'methods' GET POST PUT PATCH DELETE ;;
  esac
}
compdef _fnd_complete fnd
`;
}

function fishCompletionScript(): string {
  return `# fnd fish completion
complete -c fnd -f -a "login whoami keys projects init status doctor completions examples api help"
complete -c fnd -n "__fish_seen_subcommand_from projects" -a "list create"
complete -c fnd -n "__fish_seen_subcommand_from api" -a "GET POST PUT PATCH DELETE"
`;
}

export function completionsCommand(shellArg?: string): void {
  const shell = (shellArg || detectShell()).toLowerCase();

  if (shell === 'bash') {
    console.log(bashCompletionScript());
    return;
  }
  if (shell === 'zsh') {
    console.log(zshCompletionScript());
    return;
  }
  if (shell === 'fish') {
    console.log(fishCompletionScript());
    return;
  }

  log.error(`Unsupported shell "${shell}". Use bash, zsh, or fish.`);
  process.exitCode = 1;
}
