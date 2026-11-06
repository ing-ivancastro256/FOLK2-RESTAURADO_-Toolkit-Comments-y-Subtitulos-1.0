import { PauAnalysisResult } from './types';

/**
 * Genera un archivo Markdown profesional, limpio y estructurado con el análisis
 * Voice of Customer (VOC) y oportunidades de Productos de Alta Utilidad (PAU).
 */
export function generatePauMarkdown(
  result: PauAnalysisResult,
  options?: { videoTitle?: string; videoId?: string; modelUsed?: string }
): string {
  const {
    meta,
    avatar,
    problema_principal,
    urgencia_general,
    emocion_raiz,
    dolores = [],
    miedos = [],
    deseos = [],
    que_ha_intentado = [],
    voz_del_cliente = [],
    ideas_pau = [],
    recomendacion_final,
  } = result;

  const dateStr = result.analyzedAt
    ? new Date(result.analyzedAt).toLocaleString('es-ES', {
        dateStyle: 'full',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('es-ES', {
        dateStyle: 'full',
        timeStyle: 'short',
      });

  const lines: string[] = [];

  // Título y Metadatos del Análisis
  lines.push('# Informe de Investigación Voice of Customer (VOC) & Productos de Alta Utilidad (PAU)');
  lines.push('');
  lines.push(`> **Video Analizado:** ${options?.videoTitle || result.videoTitle || 'Video de YouTube'}`);
  if (options?.videoId || result.videoId) {
    const vid = options?.videoId || result.videoId;
    lines.push(`> **Enlace de YouTube:** [Ver Video en YouTube](https://www.youtube.com/watch?v=${vid}) (ID: \`${vid}\`)`);
  }
  lines.push(`> **Fecha de Análisis:** ${dateStr}`);
  lines.push(
    `> **Comentarios Analizados:** ${meta?.comentarios_analizados || 0} (${meta?.comentarios_descartados || 0} descartados por spam, enlaces o brevedad)`
  );
  if (options?.modelUsed) {
    lines.push(`> **Modelo de IA Utilizado:** ${options.modelUsed}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  function formatBilingualMd(text?: string | null): string {
    if (!text) return '';
    const match = text.match(/^(.*?)(?:\[(?:traducci[oó]n|trad):\s*["']?([^"'\]]+)["']?\]|\((?:traducci[oó]n|trad):\s*["']?([^"'\)]+)["']?\))/i);
    if (match) {
      const orig = match[1].trim();
      const trad = (match[2] || match[3] || '').trim();
      return `${orig} *(Traducción al Español Latino: "${trad}")*`;
    }
    return text;
  }

  // 1. Perfil del Avatar y Cliente Ideal
  lines.push('## 1. Perfil del Cliente Ideal & Avatar');
  lines.push('');
  lines.push(`- **Avatar / Arquetipo:** ${avatar?.nombre_ficticio || 'Cliente Ideal'}`);
  if (avatar?.edad_aproximada) {
    lines.push(`- **Rango de Edad Aproximado:** ${avatar.edad_aproximada}`);
  }
  lines.push(`- **Nivel de Conciencia (1 a 5):** ${avatar?.nivel_conciencia || 3}/5`);
  lines.push(`- **Situación Actual:** ${formatBilingualMd(avatar?.situacion_actual || 'Situación actual detectada en los comentarios.')}`);
  if (avatar?.que_quiere_conseguir) {
    lines.push(`- **Lo que busca conseguir:** ${formatBilingualMd(avatar.que_quiere_conseguir)}`);
  }
  if (avatar?.que_lo_bloquea && avatar.que_lo_bloquea.length > 0) {
    lines.push(`- **Qué lo bloquea:** ${avatar.que_lo_bloquea.map(formatBilingualMd).join(', ')}`);
  }
  if (avatar?.frase_caracteristica) {
    lines.push('');
    lines.push(`> 💬 **Frase Característica:** ${formatBilingualMd(avatar.frase_caracteristica)}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 2. Problema Principal y Termómetro de Urgencia
  lines.push('## 2. Problema Principal & Termómetro de Urgencia');
  lines.push('');
  lines.push(`### ${problema_principal?.titulo || problema_principal?.descripcion || 'Bloqueo Crítico Detectado'}`);
  lines.push('');
  lines.push(`**Descripción:** ${formatBilingualMd(problema_principal?.descripcion || '')}`);
  lines.push('');
  lines.push(`- **Nivel de Urgencia General:** ${urgencia_general?.nivel || problema_principal?.urgencia || 8}/10`);
  lines.push(`- **Intensidad del Dolor:** ${problema_principal?.intensidad || 8}/10`);
  if (problema_principal?.frecuencia) {
    lines.push(
      `- **Frecuencia Observada:** ${problema_principal.frecuencia} (${problema_principal.menciones_estimadas || 0} menciones estimadas)`
    );
  }
  if (problema_principal?.por_que_es_prioritario) {
    lines.push(`- **¿Por qué es prioritario resolverlo?:** ${formatBilingualMd(problema_principal.por_que_es_prioritario)}`);
  }
  if (urgencia_general?.explicacion) {
    lines.push(`- **Justificación de la Urgencia:** ${formatBilingualMd(urgencia_general.explicacion)}`);
  }
  if (emocion_raiz?.emocion_dominante) {
    lines.push(
      `- **Emoción Motora Raíz:** ${emocion_raiz.emocion_dominante} (${emocion_raiz.intensidad || 8}/10) — ${formatBilingualMd(emocion_raiz.explicacion || '')}`
    );
  }
  if (problema_principal?.evidencia && problema_principal.evidencia.length > 0) {
    lines.push('');
    lines.push('**Evidencias Textuales de los Comentarios:**');
    problema_principal.evidencia.forEach((ev) => {
      lines.push(`- ${formatBilingualMd(ev)}`);
    });
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 3. Matriz de Dolores, Miedos, Deseos y Soluciones Intentadas
  lines.push('## 3. Matriz de Dolores, Miedos, Deseos & Soluciones Intentadas');
  lines.push('');
  lines.push('### 🔴 Dolores Actuales');
  if (dolores.length === 0) {
    lines.push('_No se registraron dolores específicos en los comentarios analizados._');
  } else {
    dolores.forEach((d) => lines.push(`- ${formatBilingualMd(d)}`));
  }
  lines.push('');

  lines.push('### ⚠️ Miedos al Futuro (Si el problema continúa)');
  if (miedos.length === 0) {
    lines.push('_No se registraron miedos explícitos._');
  } else {
    miedos.forEach((m) => lines.push(`- ${formatBilingualMd(m)}`));
  }
  lines.push('');

  lines.push('### 🟢 Deseos y Resultados Esperados');
  if (deseos.length === 0) {
    lines.push('_No se detectaron deseos claros en la muestra._');
  } else {
    deseos.forEach((ds) => lines.push(`- ${formatBilingualMd(ds)}`));
  }
  lines.push('');

  lines.push('### 🔄 Soluciones ya Intentadas');
  if (que_ha_intentado.length === 0) {
    lines.push('_No hay mención de soluciones previas intentadas._');
  } else {
    que_ha_intentado.forEach((q) => lines.push(`- ${formatBilingualMd(q)}`));
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 4. La Voz del Cliente (Citas Literales Verificadas)
  lines.push(`## 4. La Voz del Cliente (Citas Literales Verificadas: ${voz_del_cliente.length})`);
  lines.push('');
  if (voz_del_cliente.length === 0) {
    lines.push('_No se hallaron citas textuales con suficiente evidencia._');
  } else {
    voz_del_cliente.forEach((c, idx) => {
      lines.push(`#### Cita #${idx + 1} — ${c.tema || 'Tema relevante'} (${c.likes || 0} likes)`);
      
      const match = (c.frase || '').match(/^(.*?)(?:\[(?:traducci[oó]n|trad):\s*["']?([^"'\]]+)["']?\])/i);
      const cleanOriginal = match ? match[1].trim() : c.frase;
      const translation = c.traduccion_espanol || (match ? match[2].trim() : null);

      lines.push(`> "${cleanOriginal}"`);
      if (translation) {
        lines.push(`>`);
        lines.push(`> 🌐 **Traducción al Español Latino:** "${translation}"`);
      }
      lines.push(`- **Por qué es relevante:** ${c.por_que_es_relevante}`);
      lines.push('');
    });
  }
  lines.push('---');
  lines.push('');

  // 5. Oportunidades & Catálogo de Ideas PAU
  lines.push('## 5. Oportunidades & Productos de Alta Utilidad (PAU)');
  lines.push('');
  if (recomendacion_final?.idea_elegida) {
    lines.push('### ⭐ RECOMENDACIÓN FINAL GANADORA');
    lines.push(`**${recomendacion_final.idea_elegida}**`);
    lines.push('');
    lines.push(`- **Motivo de Selección:** ${recomendacion_final.motivo}`);
    lines.push(`- **¿Por qué ahora?:** ${recomendacion_final.por_que_ahora}`);
    lines.push(`- **Siguiente Paso Táctico:** ${recomendacion_final.siguiente_paso}`);
    lines.push('');
  }

  lines.push('### Catálogo de Ideas PAU ($5 - $47 USD)');
  lines.push('');
  if (ideas_pau.length === 0) {
    lines.push('_No se generaron ideas específicas de PAU._');
  } else {
    ideas_pau.forEach((pau, idx) => {
      lines.push(`### [PAU #${idx + 1}] ${pau.nombre} — **$${pau.precio_sugerido_usd} USD**`);
      lines.push(`- **Formato:** ${pau.formato || 'Herramienta Digital'}`);
      lines.push(`- **Promesa Concreta:** ${pau.promesa}`);
      lines.push(`- **Problema que resuelve:** ${pau.problema_que_resuelve}`);
      lines.push(`- **Resultado Visible:** En ${pau.tiempo_resultado_dias || '1 a 3'} días`);
      lines.push(`- **Potencial Comercial:** ${pau.potencial_comercial || 8}/10 | **Urgencia:** ${pau.urgencia || 8}/10`);
      lines.push(`- **Justificación de la Oportunidad:** ${pau.por_que}`);
      if (pau.evidencia_relacionada && pau.evidencia_relacionada.length > 0) {
        lines.push('- **Evidencia relacionada de los comentarios:**');
        pau.evidencia_relacionada.forEach((ev) => lines.push(`  - "${ev}"`));
      }
      lines.push('');
    });
  }

  lines.push('---');
  lines.push(`_Informe generado por YouTube Content Intelligence Toolkit — ${dateStr}_`);

  return lines.join('\n');
}
