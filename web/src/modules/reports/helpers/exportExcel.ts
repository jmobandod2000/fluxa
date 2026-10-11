import type { Report } from '../api/reportsApi';

type Translate = (key: string, args?: Record<string, unknown>) => string;

// Libro de Excel con una hoja por vista del reporte (exceljs se carga solo al exportar)
export const exportReport = async (report: Report, businessName: string, t: Translate) => {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fluxa';

  const addSheet = (name: string, headers: string[], rows: (string | number | null)[][]) => {
    const sheet = workbook.addWorksheet(name);
    sheet.addRow(headers).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2149' } };
    rows.forEach((row) => sheet.addRow(row));
    sheet.columns.forEach((column) => (column.width = 18));
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const s = report.summary;
  addSheet(
    t('reports.sheets.summary'),
    [t('reports.metric'), t('reports.value')],
    [
      [t('reports.business'), businessName],
      [t('reports.period'), `${report.from} – ${report.to}`],
      [t('reports.kpi.issued'), s.issued],
      [t('reports.kpi.served'), s.served],
      [t('reports.kpi.noShow'), s.noShow],
      [t('reports.kpi.avgWait'), s.avgWait],
      [t('reports.kpi.p90Wait'), s.p90Wait],
      [t('reports.kpi.avgService'), s.avgService],
      [t('reports.kpi.appointments'), report.appointments.booked],
      [t('reports.kpi.checkedIn'), report.appointments.checkedIn],
    ],
  );
  const summaryHeaders = [
    t('reports.kpi.issued'),
    t('reports.kpi.served'),
    t('reports.kpi.noShow'),
    t('reports.kpi.avgWait'),
    t('reports.kpi.avgService'),
  ];
  const summaryCells = (row: Report['summary']) => [
    row.issued,
    row.served,
    row.noShow,
    row.avgWait,
    row.avgService,
  ];
  addSheet(
    t('reports.sheets.byDay'),
    [t('reports.day'), ...summaryHeaders],
    report.byDay.map((row) => [row.date, ...summaryCells(row)]),
  );
  addSheet(
    t('reports.sheets.byHour'),
    [t('reports.hour'), t('reports.kpi.issued'), t('reports.kpi.avgWait')],
    report.byHour.map((row) => [
      `${String(row.hour).padStart(2, '0')}:00`,
      row.issued,
      row.avgWait,
    ]),
  );
  addSheet(
    t('reports.sheets.bySection'),
    [t('reports.section'), ...summaryHeaders],
    report.bySection.map((row) => [row.section, ...summaryCells(row)]),
  );
  addSheet(
    t('reports.sheets.byStaff'),
    [t('reports.staff'), ...summaryHeaders],
    report.byStaff.map((row) => [row.staff, ...summaryCells(row)]),
  );
  addSheet(
    t('reports.sheets.detail'),
    [
      t('reports.code'),
      t('reports.day'),
      t('reports.section'),
      t('reports.status'),
      t('reports.arrived'),
      t('reports.called'),
      t('reports.finished'),
      t('reports.kpi.avgWait'),
      t('reports.kpi.avgService'),
      t('reports.counter'),
      t('reports.staff'),
    ],
    report.detail.map((row) => [
      row.code + (row.appointment ? ' ★' : ''),
      row.date,
      row.section,
      t(`reports.statuses.${row.status}`),
      new Date(row.createdAt).toLocaleTimeString(),
      row.calledAt ? new Date(row.calledAt).toLocaleTimeString() : null,
      row.finishedAt ? new Date(row.finishedAt).toLocaleTimeString() : null,
      row.waitMinutes,
      row.serviceMinutes,
      row.counter,
      row.staff,
    ]),
  );

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `fluxa_${report.from}_${report.to}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
