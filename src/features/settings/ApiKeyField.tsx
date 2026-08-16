import { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { maskKey } from '@/lib/settings';

interface ApiKeyFieldProps {
  id: string;
  label: string;
  hint: string;
  currentKey: string | undefined;
  onSave: (key: string) => Promise<void>;
}

/**
 * One API key, entered explicitly and saved explicitly.
 *
 * Deliberately NOT auto-saving on blur: for a user who is not fluent with
 * software, a field that silently commits is a field he cannot trust. He types,
 * he presses Speichern, he sees a confirmation.
 */
export function ApiKeyField({ id, label, hint, currentKey, onSave }: ApiKeyFieldProps) {
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = draft.trim().length > 0;

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    try {
      await onSave(draft.trim());
      setDraft('');
      setVisible(false);
      toast.success(`${label}: Schlüssel gespeichert.`);
    } catch {
      toast.error(`${label}: Schlüssel konnte nicht gespeichert werden.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        {/* Show/hide lives inside the field rather than beside it — three
            free-floating controls in a row read as three separate decisions. */}
        <InputGroup className="h-11 flex-1">
          <InputGroupInput
            id={id}
            type={visible ? 'text' : 'password'}
            value={draft}
            autoComplete="off"
            spellCheck={false}
            placeholder={currentKey ? 'Neuen Schlüssel eingeben …' : 'Schlüssel einfügen …'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
            className="font-mono"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              aria-label={visible ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="button"
          size="lg"
          className="h-11 px-5"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
        >
          Speichern
        </Button>
      </div>
      <FieldDescription>
        {currentKey ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4" aria-hidden />
            Hinterlegt: <span className="font-mono">{maskKey(currentKey)}</span>
          </span>
        ) : (
          <>Noch nicht hinterlegt. Quelle: {hint}</>
        )}
      </FieldDescription>
    </Field>
  );
}
