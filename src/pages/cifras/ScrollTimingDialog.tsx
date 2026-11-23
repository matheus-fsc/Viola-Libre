import { useEffect, useId, useRef, useState } from 'react';
import type { ScrollTimingChoice } from '../../engine/scrollTimingChoices';
import { useT } from '../../i18n';

interface Props {
  choices: readonly ScrollTimingChoice[];
  initialChoice: ScrollTimingChoice;
  onCancel(): void;
  onStart(choice: ScrollTimingChoice): void;
}

export function ScrollTimingDialog({ choices, initialChoice, onCancel, onStart }: Props) {
  const t = useT();
  const [selected, setSelected] = useState(initialChoice);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // O diálogo nativo torna a cifra inerte e mantém o foco dentro da escolha.
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input:checked')?.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onCancel(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-sm max-h-[85dvh] overflow-hidden rounded-t-lg border-[3px] border-[#0058e6] bg-[#ece9d8] text-black shadow-2xl backdrop:bg-black/60"
    >
      <h2 id={titleId} className="winxp-gradient-blue px-3 py-1.5 font-mono text-sm font-bold text-white">
        {t('cifra.rolagemTimingTitulo')}
      </h2>
      <form onSubmit={event => { event.preventDefault(); onStart(selected); }} className="flex max-h-[calc(85dvh-2.5rem)] flex-col gap-3 p-3">
        <fieldset aria-labelledby={titleId} className="min-h-0 overflow-y-auto retro-scrollbar bevel-in bg-white">
          {choices.map(choice => (
            <label key={choice.id} className="flex cursor-pointer items-start gap-2 border-b border-[#d4d0c8] px-3 py-2 text-xs last:border-0 has-checked:bg-[#e5eeff]">
              <input
                type="radio"
                name="scroll-timing"
                checked={selected.id === choice.id}
                onChange={() => setSelected(choice)}
                className="mt-0.5 accent-[#316ac5]"
              />
              <span className="min-w-0 break-words">
                <span className="font-bold">
                  {choice.kind === 'default' && t('cifra.rolagemTimingPadrao')}
                  {choice.kind === 'auto' && t('cifra.rolagemTimingAuto')}
                  {choice.kind === 'without-fingerpicking' && t('cifra.rolagemTimingSemDedilhado')}
                  {choice.kind === 'manual' && (choice.timing.editorAlias?.trim() || t('timing.apelidoPlaceholder'))}
                  {choice.kind === 'manual' && choice.timing.variant === 'sem_dedilhado' && ` (${t('timing.semDedilhado')})`}
                </span>
                {choice.kind === 'without-fingerpicking' && (
                  <span className="block text-gray-700">{t('timing.revisaoSemDedilhado')}</span>
                )}
                {choice.kind === 'manual' && (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-gray-700">
                    <span>{t('cifra.rolagemTimingVotos', { total: choice.timing.votes })}</span>
                    <span>{t('timing.totalFrases', { total: choice.timing.phrases.length })}</span>
                    {choice.timing.reviewed && (
                      <span className="bg-[#e0efdf] px-1 font-bold text-[#005500]">{t('timing.revisado')}</span>
                    )}
                  </span>
                )}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex shrink-0 justify-end gap-2 text-xs font-bold">
          <button type="button" onClick={onCancel} className="bevel-out min-h-9 border border-gray-400 bg-[#ece9d8] px-3 hover:bg-white">
            {t('comum.cancelar')}
          </button>
          <button type="submit" className="bevel-out min-h-9 border border-gray-400 bg-[#316ac5] px-3 text-white">
            {t('cifra.rolar')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
