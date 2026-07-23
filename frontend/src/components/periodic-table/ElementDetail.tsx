/**
 * Element detail view — a sidebar on desktop, a full-screen sheet on mobile
 * (the split is purely CSS). Shows every specified field, the 3D Bohr-model
 * animation, and prev/next navigation that swaps the element without closing.
 */

import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { categoryColor } from '../../constants/categories';
import type { ElementRecord } from '../../constants/elements';
import {
  formatText,
  formatTemperature,
  formatList,
  formatConfiguration,
  formatDiscoveryYear,
} from './format';

/**
 * The Bohr model pulls in Three.js (~0.5 MB). Loading it lazily keeps that
 * weight out of the initial grid bundle — it is fetched only when the first
 * element detail opens. The fallback holds the canvas's space so the layout
 * doesn't jump.
 */
const BohrModel = lazy(() => import('./BohrModel'));

interface ElementDetailProps {
  element: ElementRecord;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export default function ElementDetail({
  element,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onClose,
}: ElementDetailProps) {
  const { t } = useTranslation();
  const f = (key: string): string => t(`periodicTable.fields.${key}`);

  const token = categoryColor(element.group as Parameters<typeof categoryColor>[0]);
  const categoryLabel = t(`categories.${element.group}`);

  return (
    <aside
      className="element-detail glass glass--raised"
      aria-label={`${element.name} (${element.symbol})`}
      // Set once on the panel: the badge and the category label both derive
      // their tints from this single token.
      style={{ ['--cell-color' as string]: `var(${token})` }}
    >
      <header className="element-detail__header">
        <div className="element-detail__badge">
          <span className="element-detail__badge-number">{element.atomicNumber}</span>
          <span className="element-detail__badge-symbol">{element.symbol}</span>
        </div>
        <div className="element-detail__titles">
          <h2 className="element-detail__name">{element.name}</h2>
          <p className="element-detail__category">{categoryLabel}</p>
          {element.needsReview && (
            <p className="element-detail__review">{t('periodicTable.needsReview')}</p>
          )}
        </div>
        <button
          type="button"
          className="element-detail__close control control--icon"
          onClick={onClose}
          aria-label={t('periodicTable.close')}
        >
          ×
        </button>
      </header>

      <Suspense fallback={<div className="bohr-model" aria-hidden="true" />}>
        <BohrModel
          atomicNumber={element.atomicNumber}
          atomicMass={element.atomicMass}
          electronConfiguration={element.electronConfiguration}
          label={`${t('periodicTable.fields.electronConfiguration')}: ${element.name}`}
        />
      </Suspense>

      <nav className="element-detail__nav" aria-label={element.name}>
        <button type="button" className="control" onClick={onPrev} disabled={!canPrev}>
          ‹ {t('periodicTable.previous')}
        </button>
        <button type="button" className="control" onClick={onNext} disabled={!canNext}>
          {t('periodicTable.next')} ›
        </button>
      </nav>

      {element.description && (
        <p className="element-detail__description">{element.description}</p>
      )}

      <dl className="element-detail__facts">
        <Fact label={f('atomicNumber')} value={String(element.atomicNumber)} />
        <Fact label={f('atomicMass')} value={formatText(element.atomicMass === null ? null : String(element.atomicMass))} />
        <Fact label={f('category')} value={categoryLabel} />
        <Fact label={f('electronConfiguration')} value={formatConfiguration(element.electronConfiguration)} />
        <Fact label={f('meltingPoint')} value={formatTemperature(element.meltingPointC, element.meltingPointK)} />
        <Fact label={f('boilingPoint')} value={formatTemperature(element.boilingPointC, element.boilingPointK)} />
        <Fact
          label={f('discovery')}
          value={formatDiscoveryYear(element.discoveryDate, (year) =>
            t('periodicTable.discoveryBce', { year }),
          )}
        />
        <Fact label={f('discoverer')} value={formatText(element.discoverer)} />
        <Fact label={f('halfLife')} value={formatText(element.halfLife)} />
        <Fact label={f('isotopes')} value={formatList(element.knownIsotopes)} />
      </dl>

      {element.uses && (
        <section className="element-detail__prose">
          <h3>{f('uses')}</h3>
          <p>{element.uses}</p>
        </section>
      )}
      {element.characteristics && (
        <section className="element-detail__prose">
          <h3>{f('characteristics')}</h3>
          <p>{element.characteristics}</p>
        </section>
      )}

      {element.sources.length > 0 && (
        <footer className="element-detail__sources">
          {element.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
              {source.label}
            </a>
          ))}
        </footer>
      )}
    </aside>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="element-detail__fact">
      <dt className="field__label">{label}</dt>
      <dd className="field__value">{value}</dd>
    </div>
  );
}
