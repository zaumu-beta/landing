/**
 * Chart.js charts for the creator directory, styled after the app's Reports
 * page: pastel platform colours, fat rounded bars, a doughnut with gaps,
 * and the black-solid / green-dashed / blue-dotted line trio.
 *
 * Loaded lazily by initCharts() in main.ts — only on pages that contain
 * <canvas data-chart="…" data-series="…">.
 */
import { Chart, DoughnutController, BarController, LineController, ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, type ChartConfiguration } from 'chart.js'

Chart.register(DoughnutController, BarController, LineController, ArcElement, BarElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

/* Platform colours — same family as app.zaumu.com/dashboard/reports */
export const PLATFORM_COLOR: Record<string, string> = {
  facebook: '#9d97f5',
  instagram: '#ec5f9f',
  tiktok: '#8ec5ff',
  youtube: '#ff9a9e',
  x: '#b4bcc6',
}
const INK = '#141517'
const GREEN = '#2ee59d'
const BLUE = '#5b8def'
const FONT = { family: 'Montserrat, ui-sans-serif, system-ui, sans-serif', size: 10, weight: 600 as const }

Chart.defaults.font = { ...Chart.defaults.font, ...FONT }
Chart.defaults.color = 'rgba(0,0,0,.55)'
Chart.defaults.plugins.tooltip.backgroundColor = INK
Chart.defaults.plugins.tooltip.titleFont = { ...FONT, weight: 700 }
Chart.defaults.plugins.tooltip.bodyFont = FONT
Chart.defaults.plugins.tooltip.padding = 8
Chart.defaults.plugins.tooltip.cornerRadius = 8
Chart.defaults.plugins.tooltip.displayColors = false

const compact = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n))

interface Categorical { labels: string[]; full?: string[]; platforms: string[]; values: number[] }
interface Trend { likes: number[]; views: number[]; comments: number[] }

const legendBottom = {
  display: true,
  position: 'bottom' as const,
  align: 'center' as const,
  labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6, boxHeight: 6, padding: 8, font: { ...FONT, size: 9 } },
}

export function doughnut(d: Categorical): ChartConfiguration<'doughnut'> {
  return {
    type: 'doughnut',
    data: {
      labels: d.labels.map((l, i) => `${l} ${compact(d.values[i]!)}`),
      datasets: [{ data: d.values, backgroundColor: d.platforms.map((p) => PLATFORM_COLOR[p] ?? '#ccc'), borderWidth: 0, spacing: 4, borderRadius: 6, hoverOffset: 4 }],
    },
    options: {
      cutout: '60%',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 2 },
      plugins: { legend: legendBottom, tooltip: { callbacks: { label: (c) => ` ${compact(c.parsed)} posts` } } },
    },
  }
}

export function bars(d: Categorical): ChartConfiguration<'bar'> {
  return {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [{ data: d.values, backgroundColor: d.platforms.map((p) => PLATFORM_COLOR[p] ?? '#ccc'), borderRadius: 10, borderSkipped: false, barPercentage: 0.7, categoryPercentage: 0.8 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4 } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { ...FONT, size: 9 }, maxRotation: 0, autoSkip: false } },
        y: { display: false, beginAtZero: true },
      },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => d.full?.[items[0]?.dataIndex ?? 0] ?? '', label: (c) => ` ${compact(c.parsed.y ?? 0)} followers` } } },
    },
  }
}

export function line(t: Trend): ChartConfiguration<'line'> {
  const labels = t.likes.map((_, i) => `Day ${i + 1}`)
  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Likes', data: t.likes, borderColor: INK, borderWidth: 2, pointRadius: 0, tension: 0.4, yAxisID: 'y' },
        { label: 'Views', data: t.views, borderColor: GREEN, borderWidth: 2, borderDash: [5, 4], pointRadius: 0, tension: 0.4, yAxisID: 'y2' },
        { label: 'Comments', data: t.comments, borderColor: BLUE, borderWidth: 2, borderDash: [1, 4], borderCapStyle: 'round', pointRadius: 0, tension: 0.4, yAxisID: 'y3' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 4, right: 2 } },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true },
        y2: { display: false, beginAtZero: true, position: 'right' },
        y3: { display: false, beginAtZero: true, position: 'right' },
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 14, padding: 8, font: { ...FONT, size: 9 } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${compact(c.parsed.y ?? 0)}` } },
      },
    },
  }
}

export function render(canvas: HTMLCanvasElement): Chart | undefined {
  const type = canvas.dataset.chart
  const series = JSON.parse(canvas.dataset.series || '{}')
  const config =
    type === 'doughnut' ? doughnut(series) : type === 'bar' ? bars(series) : type === 'line' ? line(series) : null
  if (!config) return undefined
  return new Chart(canvas, config as ChartConfiguration)
}
