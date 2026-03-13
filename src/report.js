/**
 * report.js
 * ---------
 * Formats the analyzed opportunities into a readable CLI report.
 * Designed to be skimmable in 30 seconds and actionable immediately.
 */

const GO_COLORS = {
  'GO':     '✅ GO',
  'NO-GO':  '❌ NO-GO',
  'MAYBE':  '🟡 MAYBE',
};

/**
 * @param {Array} analyzed - Sorted array of enriched + analyzed opportunities
 * @returns {string} - Formatted report string
 */
export function formatReport(analyzed) {
  const lines = [];

  lines.push('═'.repeat(64));
  lines.push('  GOVCON AI AGENT  —  Opportunity Report');
  lines.push(`  Generated: ${new Date().toLocaleString()}`);
  lines.push('═'.repeat(64));

  analyzed.forEach((opp, i) => {
    const a = opp.analysis;
    const rank = i + 1;
    const scoreBar = '█'.repeat(a.score) + '░'.repeat(10 - a.score);

    lines.push('');
    lines.push(`  #${rank}  ${opp.title}`);
    lines.push(`  ${opp.agency}`);
    lines.push('  ' + '─'.repeat(60));

    lines.push(`  Decision:   ${GO_COLORS[a.goNoGo] ?? a.goNoGo}`);
    lines.push(`  Score:      ${scoreBar}  ${a.score}/10`);
    lines.push(`  Value:      ${a.estimatedValue ?? 'Not specified'}`);
    lines.push(`  Deadline:   ${a.deadline ?? opp.responseDeadline ?? 'TBD'}`);
    lines.push(`  Set-aside:  ${opp.setAside}`);
    lines.push(`  NAICS:      ${opp.naicsCode}`);
    lines.push(`  Link:       ${opp.uiLink}`);
    lines.push('');

    lines.push(`  Summary`);
    lines.push(wrapText(a.summary, 58, '    '));
    lines.push('');

    if (a.keyRequirements?.length) {
      lines.push(`  Key requirements`);
      a.keyRequirements.forEach((r) => lines.push(`    • ${r}`));
      lines.push('');
    }

    lines.push(`  Win factors`);
    (a.winFactors ?? []).forEach((f) => lines.push(`    ✓ ${f}`));
    lines.push('');

    lines.push(`  Risks`);
    (a.risks ?? []).forEach((r) => lines.push(`    ✗ ${r}`));
    lines.push('');

    if (a.goNoGo === 'GO' || a.goNoGo === 'MAYBE') {
      lines.push(`  Proposal outline`);
      (a.proposalOutline ?? []).forEach((s, j) =>
        lines.push(`    ${j + 1}. ${s}`)
      );
    }

    lines.push('');
    lines.push('  ' + '─'.repeat(60));
  });

  lines.push('');
  lines.push('═'.repeat(64));
  lines.push(`  ${analyzed.length} opportunities analyzed. Top pick: ${analyzed[0]?.title?.slice(0, 50) ?? 'N/A'}`);
  lines.push('═'.repeat(64));
  lines.push('');

  return lines.join('\n');
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function wrapText(text, width, indent = '') {
  if (!text) return '';
  const words  = text.split(' ');
  const output = [];
  let   line   = indent;

  for (const word of words) {
    if (line.length + word.length + 1 > width + indent.length) {
      output.push(line);
      line = indent + word;
    } else {
      line += (line === indent ? '' : ' ') + word;
    }
  }
  if (line.trim()) output.push(line);
  return output.join('\n');
}