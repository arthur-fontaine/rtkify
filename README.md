# Rtkify

**Without Rtkify**:

```bash
cd .. && ENV=1 ~/.cargo/bin/cargo test some_test -- --nocapture 2>&1; echo "exit: $?"
```

> `rtk` [detects the `cd`](https://github.com/rtk-ai/rtk/blob/b812a0e92497fc5b395f2db584298454e2bcd7a3/src/discover/rules.rs#L669) and so skips the whole command.

**With Rtkify**:

```bash
cd .. && ENV=1 rtk cargo test some_test -- --nocapture 2>&1; echo "exit: $?"
```

> `rtkify` creates an AST of the command and detects that `cd` and `cargo` are separate commands, so it only skips the `cd` and rewrites the `cargo` command as expected.

## Usage

```bash
npx -p @arthur-fontaine/rtkify rtkify <command>
```

If you want to install it globally, you can use the following command:

```bash
npm install -g @arthur-fontaine/rtkify
```

Then you can use it as follows:

```bash
rtkify <command>
```
