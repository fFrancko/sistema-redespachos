import { z } from 'zod';

// `vigencia_hasta` nula o >= `vigencia_desde`. Las fechas yyyy-MM-dd ya validadas se comparan
// por orden léxico, que coincide con el cronológico.
export function checkVigencia(
  data: { vigencia_desde: string; vigencia_hasta: string | null },
  ctx: z.RefinementCtx,
): void {
  if (data.vigencia_hasta !== null && data.vigencia_hasta < data.vigencia_desde) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['vigencia_hasta'],
      message: 'vigencia_hasta debe ser nula o mayor o igual a vigencia_desde',
    });
  }
}
