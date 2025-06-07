// 智能文档分割工具
// 完全移植自 simple/js/processing.js 中的分割算法

/**
 * 估算文本的 token 数量
 * 完全移植自 simple/js/processing.js 中的 estimateTokenCount 函数
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;

  // 使用与 simple 版本完全相同的逻辑
  // A slightly more refined estimation might be better
  const nonAsciiRatio = (text.match(/[^ - ]/g) || []).length / text.length;

  if (nonAsciiRatio > 0.3) {
    // Heuristic for CJK languages
    return Math.ceil(text.length * 1.1);
  } else {
    // Roughly 3-4 chars per token for English/code
    return Math.ceil(text.length / 3.5);
  }
}

/**
 * 智能分割 Markdown 文档为多个块
 * 增强版本：保护表格、代码块、列表等结构化内容的完整性
 */
export function smartSplitTextIntoChunks(markdown: string, tokenLimit: number, logContext: string = ""): string[] {
  const estimatedTokens = estimateTokenCount(markdown);

  // 添加日志回调支持（如果可用）
  const addProgressLog = (message: string) => {
    console.log(message);
    // 如果有全局的 addProgressLog 函数，也调用它
    if (typeof (globalThis as any).addProgressLog === 'function') {
      (globalThis as any).addProgressLog(message);
    }
  };

  addProgressLog(`${logContext} 估算总 token 数: ~${estimatedTokens}, 分段限制: ${tokenLimit}`);

  // 如果文档不超过限制，直接返回
  if (estimatedTokens <= tokenLimit * 1.1) {
    addProgressLog(`${logContext} 文档未超过大小限制，不进行分割。`);
    return [markdown];
  }

  addProgressLog(`${logContext} 文档超过大小限制，开始智能分割...`);

  // 使用增强的分段算法
  return smartSplitWithStructurePreservation(markdown, tokenLimit, logContext, addProgressLog);
}

/**
 * 增强的分段算法：保护结构化内容的完整性
 */
function smartSplitWithStructurePreservation(
  markdown: string,
  tokenLimit: number,
  logContext: string,
  addProgressLog: (message: string) => void
): string[] {
  const lines = markdown.split('\n');
  const chunks: string[] = [];
  let currentChunkLines: string[] = [];
  let currentTokenCount = 0;

  // 状态跟踪
  let inCodeBlock = false;
  let inTable = false;
  let inList = false;
  let listIndentLevel = 0;

  // 正则表达式
  const headingRegex = /^(#+)\s+.*/;
  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:]+\|\s*$/;
  const listItemRegex = /^(\s*)([-*+]|\d+\.)\s+/;
  const codeBlockRegex = /^\s*```/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineTokens = estimateTokenCount(line);
    const trimmedLine = line.trim();

    // 更新状态
    updateParsingState(line, {
      inCodeBlock: () => inCodeBlock,
      setInCodeBlock: (value: boolean) => { inCodeBlock = value; },
      inTable: () => inTable,
      setInTable: (value: boolean) => { inTable = value; },
      inList: () => inList,
      setInList: (value: boolean) => { inList = value; },
      listIndentLevel: () => listIndentLevel,
      setListIndentLevel: (value: number) => { listIndentLevel = value; }
    });

    let shouldSplit = false;

    if (currentChunkLines.length > 0) {
      // 检查是否超过token限制
      if (currentTokenCount + lineTokens > tokenLimit) {
        if (currentTokenCount > tokenLimit * 0.1) {
          // 只有在不破坏结构的情况下才分割
          if (!inCodeBlock && !inTable && !inList) {
            shouldSplit = true;
            addProgressLog(`${logContext} 分割点 (Token Limit): 行 ${i+1}, 当前 ${currentTokenCount} + ${lineTokens} > ${tokenLimit}`);
          }
        }
      }
      // 在标题处分割（如果不在任何结构中）
      else if (!inCodeBlock && !inTable && !inList && headingRegex.test(line)) {
        const match = line.match(headingRegex);
        if (match && match[1].length <= 2 && currentTokenCount > tokenLimit * 0.5) {
          shouldSplit = true;
          addProgressLog(`${logContext} 分割点 (Heading H${match[1].length}): 行 ${i+1}, 当前 ${currentTokenCount} > ${tokenLimit * 0.5}`);
        }
      }
      // 在段落边界分割（如果不在任何结构中且遇到空行）
      else if (!inCodeBlock && !inTable && !inList && trimmedLine === '' && currentTokenCount > tokenLimit * 0.7) {
        shouldSplit = true;
        addProgressLog(`${logContext} 分割点 (Paragraph Break): 行 ${i+1}, 当前 ${currentTokenCount} > ${tokenLimit * 0.7}`);
      }
    }

    if (shouldSplit) {
      chunks.push(currentChunkLines.join('\n'));
      currentChunkLines = [];
      currentTokenCount = 0;
    }

    currentChunkLines.push(line);
    currentTokenCount += lineTokens;
  }

  // 添加最后一个块
  if (currentChunkLines.length > 0) {
    chunks.push(currentChunkLines.join('\n'));
  }

  addProgressLog(`${logContext} 结构保护分割为 ${chunks.length} 个片段.`);

  // 二次分割：处理仍然过大的块
  const finalChunks: string[] = [];
  for (let j = 0; j < chunks.length; j++) {
    const chunk = chunks[j];
    const chunkTokens = estimateTokenCount(chunk);
    if (chunkTokens > tokenLimit * 1.1) {
      addProgressLog(`${logContext} 警告: 第 ${j+1} 段 (${chunkTokens} tokens) 仍然超过限制 ${tokenLimit}. 尝试段落分割.`);
      const subChunks = splitByParagraphs(chunk, tokenLimit, logContext, j + 1);
      finalChunks.push(...subChunks);
    } else {
      finalChunks.push(chunk);
    }
  }

  if (finalChunks.length !== chunks.length) {
    addProgressLog(`${logContext} 二次分割后总片段数: ${finalChunks.length}`);
  }

  return finalChunks;
}

/**
 * 更新解析状态
 */
function updateParsingState(line: string, state: any): void {
  const trimmedLine = line.trim();

  // 代码块状态
  if (trimmedLine.startsWith('```')) {
    state.setInCodeBlock(!state.inCodeBlock());
    return;
  }

  // 如果在代码块中，不更新其他状态
  if (state.inCodeBlock()) {
    return;
  }

  // 表格状态
  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:]+\|\s*$/;

  if (tableRowRegex.test(line) || tableSeparatorRegex.test(line)) {
    if (!state.inTable()) {
      state.setInTable(true);
    }
  } else if (state.inTable() && trimmedLine === '') {
    // 表格后的空行，可能结束表格
    state.setInTable(false);
  } else if (state.inTable() && !tableRowRegex.test(line) && trimmedLine !== '') {
    // 非表格行且非空行，结束表格
    state.setInTable(false);
  }

  // 列表状态
  const listItemRegex = /^(\s*)([-*+]|\d+\.)\s+/;
  const match = line.match(listItemRegex);

  if (match) {
    const indentLevel = match[1].length;
    state.setInList(true);
    state.setListIndentLevel(indentLevel);
  } else if (state.inList()) {
    // 检查是否仍在列表中
    if (trimmedLine === '') {
      // 空行，保持列表状态
    } else if (line.startsWith(' '.repeat(state.listIndentLevel() + 2))) {
      // 列表项的续行
    } else {
      // 退出列表
      state.setInList(false);
      state.setListIndentLevel(0);
    }
  }
}

/**
 * 按段落分割文本（增强版本：保护表格结构）
 */
function splitByParagraphs(text: string, tokenLimit: number, logContext: string, chunkIndex: number): string[] {
  // 添加日志回调支持（如果可用）
  const addProgressLog = (message: string) => {
    console.log(message);
    // 如果有全局的 addProgressLog 函数，也调用它
    if (typeof (globalThis as any).addProgressLog === 'function') {
      (globalThis as any).addProgressLog(message);
    }
  };

  addProgressLog(`${logContext} 对第 ${chunkIndex} 段进行结构保护的段落分割...`);

  // 使用更智能的段落分割，保护表格和其他结构
  return splitByStructuralUnits(text, tokenLimit, logContext, chunkIndex, addProgressLog);
}

/**
 * 按结构单元分割文本（表格、段落、列表等）
 */
function splitByStructuralUnits(
  text: string,
  tokenLimit: number,
  logContext: string,
  chunkIndex: number,
  addProgressLog: (message: string) => void
): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let currentUnit: string[] = [];
  let currentTokenCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 检测结构化内容
    if (isTableStart(line, lines, i)) {
      // 处理表格
      const tableResult = extractTable(lines, i);
      const tableContent = tableResult.content;
      const tableTokens = estimateTokenCount(tableContent);

      // 如果当前单元加上表格会超过限制，先保存当前单元
      if (currentUnit.length > 0 && currentTokenCount + tableTokens > tokenLimit) {
        chunks.push(currentUnit.join('\n'));
        currentUnit = [];
        currentTokenCount = 0;
      }

      // 如果表格本身就超过限制，单独作为一个块
      if (tableTokens > tokenLimit * 1.1) {
        addProgressLog(`${logContext} 警告: 表格 (${tableTokens} tokens) 超过限制 ${tokenLimit}，但保持完整性.`);
        if (currentUnit.length > 0) {
          chunks.push(currentUnit.join('\n'));
          currentUnit = [];
          currentTokenCount = 0;
        }
        chunks.push(tableContent);
      } else {
        currentUnit.push(tableContent);
        currentTokenCount += tableTokens;
      }

      i = tableResult.nextIndex;
    } else if (isCodeBlockStart(line)) {
      // 处理代码块
      const codeBlockResult = extractCodeBlock(lines, i);
      const codeContent = codeBlockResult.content;
      const codeTokens = estimateTokenCount(codeContent);

      // 如果当前单元加上代码块会超过限制，先保存当前单元
      if (currentUnit.length > 0 && currentTokenCount + codeTokens > tokenLimit) {
        chunks.push(currentUnit.join('\n'));
        currentUnit = [];
        currentTokenCount = 0;
      }

      currentUnit.push(codeContent);
      currentTokenCount += codeTokens;
      i = codeBlockResult.nextIndex;
    } else if (isListStart(line)) {
      // 处理列表
      const listResult = extractList(lines, i);
      const listContent = listResult.content;
      const listTokens = estimateTokenCount(listContent);

      // 如果当前单元加上列表会超过限制，先保存当前单元
      if (currentUnit.length > 0 && currentTokenCount + listTokens > tokenLimit) {
        chunks.push(currentUnit.join('\n'));
        currentUnit = [];
        currentTokenCount = 0;
      }

      currentUnit.push(listContent);
      currentTokenCount += listTokens;
      i = listResult.nextIndex;
    } else {
      // 处理普通行
      const lineTokens = estimateTokenCount(line);

      // 如果添加这行会超过限制，先保存当前单元
      if (currentUnit.length > 0 && currentTokenCount + lineTokens > tokenLimit) {
        chunks.push(currentUnit.join('\n'));
        currentUnit = [];
        currentTokenCount = 0;
      }

      currentUnit.push(line);
      currentTokenCount += lineTokens;
      i++;
    }
  }

  // 添加最后一个单元
  if (currentUnit.length > 0) {
    chunks.push(currentUnit.join('\n'));
  }

  addProgressLog(`${logContext} 第 ${chunkIndex} 段按结构单元分割为 ${chunks.length} 个子段.`);
  return chunks;
}

/**
 * 检测是否为表格开始
 */
function isTableStart(line: string, lines: string[], index: number): boolean {
  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:]+\|\s*$/;

  // 当前行是表格行
  if (tableRowRegex.test(line)) {
    // 检查下一行是否为分隔符行
    if (index + 1 < lines.length && tableSeparatorRegex.test(lines[index + 1])) {
      return true;
    }
    // 或者检查上一行是否为分隔符行
    if (index > 0 && tableSeparatorRegex.test(lines[index - 1])) {
      return false; // 已经在表格中了
    }
  }

  return false;
}

/**
 * 提取完整的表格
 */
function extractTable(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  const tableRowRegex = /^\s*\|.*\|\s*$/;
  const tableSeparatorRegex = /^\s*\|[\s\-:]+\|\s*$/;

  let endIndex = startIndex;

  // 找到表格的结束位置
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (tableRowRegex.test(line) || tableSeparatorRegex.test(line)) {
      endIndex = i;
    } else if (line.trim() === '') {
      // 空行，可能是表格结束，但继续检查下一行
      if (i + 1 < lines.length && (tableRowRegex.test(lines[i + 1]) || tableSeparatorRegex.test(lines[i + 1]))) {
        // 下一行还是表格，继续
        endIndex = i;
      } else {
        // 表格结束
        break;
      }
    } else {
      // 非表格行，表格结束
      break;
    }
  }

  const content = lines.slice(startIndex, endIndex + 1).join('\n');
  return { content, nextIndex: endIndex + 1 };
}

/**
 * 检测是否为代码块开始
 */
function isCodeBlockStart(line: string): boolean {
  return line.trim().startsWith('```');
}

/**
 * 提取完整的代码块
 */
function extractCodeBlock(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  let endIndex = startIndex;

  // 找到代码块的结束位置
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```')) {
      endIndex = i;
      break;
    }
  }

  const content = lines.slice(startIndex, endIndex + 1).join('\n');
  return { content, nextIndex: endIndex + 1 };
}

/**
 * 检测是否为列表开始
 */
function isListStart(line: string): boolean {
  const listItemRegex = /^(\s*)([-*+]|\d+\.)\s+/;
  return listItemRegex.test(line);
}

/**
 * 提取完整的列表
 */
function extractList(lines: string[], startIndex: number): { content: string; nextIndex: number } {
  const listItemRegex = /^(\s*)([-*+]|\d+\.)\s+/;
  const startMatch = lines[startIndex].match(listItemRegex);
  if (!startMatch) {
    return { content: lines[startIndex], nextIndex: startIndex + 1 };
  }

  const baseIndentLevel = startMatch[1].length;
  let endIndex = startIndex;

  // 找到列表的结束位置
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      // 空行，继续检查
      endIndex = i;
      continue;
    }

    const match = line.match(listItemRegex);
    if (match) {
      const indentLevel = match[1].length;
      if (indentLevel >= baseIndentLevel) {
        // 同级或子级列表项
        endIndex = i;
        continue;
      } else {
        // 更高级的列表项，列表结束
        break;
      }
    } else if (line.startsWith(' '.repeat(baseIndentLevel + 2))) {
      // 列表项的续行
      endIndex = i;
      continue;
    } else {
      // 非列表内容，列表结束
      break;
    }
  }

  const content = lines.slice(startIndex, endIndex + 1).join('\n');
  return { content, nextIndex: endIndex + 1 };
}

/**
 * 计算重试延迟时间
 * 参考 simple/js/processing.js 中的重试逻辑
 */
export function getRetryDelay(attempt: number): number {
  // 指数退避：1s, 2s, 4s, 8s...
  return Math.min(1000 * Math.pow(2, attempt), 10000); // 最大10秒
}
