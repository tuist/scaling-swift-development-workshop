import pc from "picocolors";

/**
 * A drop-in replacement for clack's `note()` that doesn't dim its contents.
 *
 * clack wraps every body line in `color.dim`, which is fine for a three-line
 * confirmation and bad for a task brief: on a light terminal the text washes out
 * to barely-there grey, and any `bold` inside it is fighting the surrounding dim.
 * Task briefs are the main reading surface of this workshop, so they render at
 * full contrast and choose their own emphasis.
 *
 * Box geometry matches clack's exactly, so this sits in the same gutter as
 * everything else and nobody notices the seam.
 */

const S_BAR = "│";
const S_BAR_H = "─";
const S_STEP_SUBMIT = "◇";
const S_CORNER_TOP_RIGHT = "╮";
const S_CONNECT_LEFT = "├";
const S_CORNER_BOTTOM_RIGHT = "╯";

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

/** Printable width, ignoring colour escapes. */
export const visibleLength = (text: string): number => text.replace(ANSI, "").length;

/**
 * A block meant to be copied, so it has no box and no gutter.
 *
 * The whole value of the commands reveal is that you can select it and paste it.
 * Wrap that in clack's gutter and every pasted line arrives prefixed with `│  `
 * and trailing box-drawing characters — the one reveal people actually need to
 * copy is the one they can't. So: a title rule, then bare text at column zero.
 *
 * Bodies are written as shell scripts with `#` comments, which means the prose
 * survives the paste too rather than having to be stripped out by hand.
 */
export const codeBlock = (message = "", title = ""): void => {
  const width = Math.max(24, Math.min(process.stdout.columns ?? 80, 88) - 4);
  const titleLen = visibleLength(title);
  const rule = pc.gray(S_BAR_H.repeat(Math.max(width - titleLen - 3, 1)));

  process.stdout.write(
    `${pc.gray(S_BAR)}\n` +
      `${pc.green(S_STEP_SUBMIT)}  ${title} ${rule}\n\n` +
      `${message}\n\n` +
      `${pc.gray(S_BAR_H.repeat(width))}\n`,
  );
};

/** Greys the comments in a shell snippet so the commands themselves stand out. */
export const shell = (script: string): string =>
  script
    .split("\n")
    .map((line) => (line.trimStart().startsWith("#") ? pc.gray(line) : line))
    .join("\n");

export const note = (message = "", title = ""): void => {
  const lines = `\n${message}\n`.split("\n");
  const titleLen = visibleLength(title);
  const width =
    Math.max(
      lines.reduce((longest, line) => Math.max(longest, visibleLength(line)), 0),
      titleLen,
    ) + 2;

  const body = lines
    .map((line) => `${pc.gray(S_BAR)}  ${line}${" ".repeat(width - visibleLength(line))}${pc.gray(S_BAR)}`)
    .join("\n");

  const header =
    `${pc.gray(S_BAR)}\n` +
    `${pc.green(S_STEP_SUBMIT)}  ${title} ` +
    pc.gray(S_BAR_H.repeat(Math.max(width - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT);

  const footer = pc.gray(S_CONNECT_LEFT + S_BAR_H.repeat(width + 2) + S_CORNER_BOTTOM_RIGHT);

  process.stdout.write(`${header}\n${body}\n${footer}\n`);
};
