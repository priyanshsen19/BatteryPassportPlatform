'use client';

import {
  BATTERY_CATEGORIES,
  BATTERY_STATUSES,
  passportRequestSchema,
  type PassportDto,
  type PassportRequest,
} from '@bpp/shared/schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Controller,
  FormProvider,
  get,
  useFieldArray,
  useForm,
  useFormContext,
  type FieldPath,
} from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, fieldAria } from '@/components/ui/form-controls';
import { Section } from '@/components/ui/surface';
import { ApiError } from '@/lib/api-client';
import { useSavePassport } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { TagInput } from './tag-input';

type Path = FieldPath<PassportRequest>;

const EMPTY_PASSPORT = {
  data: {
    generalInformation: {
      batteryIdentifier: '',
      batteryModel: { id: '', modelName: '' },
      batteryMass: undefined,
      batteryCategory: 'EV',
      batteryStatus: 'Original',
      manufacturingDate: '',
      manufacturingPlace: '',
      warrantyPeriod: '',
      manufacturerInformation: { manufacturerName: '', manufacturerIdentifier: '' },
    },
    materialComposition: { batteryChemistry: '', criticalRawMaterials: [], hazardousSubstances: [] },
    carbonFootprint: { totalCarbonFootprint: undefined, measurementUnit: 'kg CO2e', methodology: '' },
  },
} as unknown as PassportRequest;

const fieldId = (name: string) => name.replace(/\./g, '-');

function useFieldError(name: Path): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<PassportRequest>();
  return (get(errors, name) as { message?: string } | undefined)?.message;
}

interface TextFieldProps {
  name: Path;
  label: string;
  type?: 'text' | 'number' | 'date';
  hint?: string;
  placeholder?: string;
  className?: string;
  step?: string;
  mono?: boolean;
}

function TextField({ name, label, type = 'text', hint, placeholder, className, step, mono }: TextFieldProps) {
  const { register } = useFormContext<PassportRequest>();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Field id={id} label={label} error={error} hint={hint} required className={className}>
      <Input
        type={type}
        step={step}
        inputMode={type === 'number' ? 'decimal' : undefined}
        placeholder={placeholder}
        invalid={!!error}
        className={cn(mono && 'font-mono')}
        {...fieldAria(id, error, hint)}
        {...register(name, type === 'number' ? { valueAsNumber: true } : undefined)}
      />
    </Field>
  );
}

function SelectField({ name, label, options }: { name: Path; label: string; options: readonly string[] }) {
  const { register } = useFormContext<PassportRequest>();
  const error = useFieldError(name);
  const id = fieldId(name);
  return (
    <Field id={id} label={label} error={error} required>
      <Select invalid={!!error} {...fieldAria(id, error)} {...register(name)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function CriticalRawMaterialsField() {
  const { control } = useFormContext<PassportRequest>();
  const name = 'data.materialComposition.criticalRawMaterials' as const;
  const error = useFieldError(name);
  const id = fieldId(name);
  const hint = 'Press Enter to add each material.';
  return (
    <Field
      id={id}
      label="Critical raw materials"
      error={error}
      hint={hint}
      required
      className="sm:col-span-2"
    >
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TagInput
            id={id}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder="e.g. Lithium"
            invalid={!!error}
            describedBy={error ? `${id}-error` : `${id}-hint`}
          />
        )}
      />
    </Field>
  );
}

function HazardousSubstancesField() {
  const { control } = useFormContext<PassportRequest>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'data.materialComposition.hazardousSubstances',
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-ink">Hazardous substances</p>
          <p className="text-xs text-ink-subtle">Leave empty if the battery contains none.</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append({ substanceName: '', chemicalFormula: '', casNumber: '' })}
        >
          <Plus />
          Add substance
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-ink-subtle">
          No hazardous substances added.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((field, index) => (
            <li key={field.id} className="rounded-md border border-line bg-subtle/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Substance {index + 1}</span>
                <Button
                  type="button"
                  variant="danger-ghost"
                  size="icon-sm"
                  onClick={() => remove(index)}
                  aria-label={`Remove substance ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
              <Grid>
                <TextField
                  name={`data.materialComposition.hazardousSubstances.${index}.substanceName`}
                  label="Substance name"
                />
                <TextField
                  name={`data.materialComposition.hazardousSubstances.${index}.chemicalFormula`}
                  label="Chemical formula"
                  mono
                />
                <TextField
                  name={`data.materialComposition.hazardousSubstances.${index}.casNumber`}
                  label="CAS number"
                  placeholder="21324-40-3"
                  mono
                />
              </Grid>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

interface PassportFormProps {
  passport?: PassportDto;
}

export function PassportForm({ passport }: PassportFormProps) {
  const router = useRouter();
  const save = useSavePassport(passport?.id);
  const methods = useForm<PassportRequest>({
    resolver: zodResolver(passportRequestSchema),
    defaultValues: passport ? { data: passport.data } : EMPTY_PASSPORT,
    mode: 'onTouched',
  });

  const onSubmit = async (values: PassportRequest) => {
    try {
      const saved = await save.mutateAsync(values);
      toast.success(passport ? 'Passport updated' : 'Passport created', {
        description: saved.data.generalInformation.batteryIdentifier,
      });
      router.push(`/passports/${saved.id}`);
    } catch (err) {
      if (!(err instanceof ApiError)) {
        toast.error('Could not save the passport');
        return;
      }
      if (err.code === 'BATTERY_IDENTIFIER_EXISTS') {
        methods.setError(
          'data.generalInformation.batteryIdentifier',
          { message: err.message },
          { shouldFocus: true },
        );
      }
      err.details.forEach(({ field, message }) => methods.setError(field as Path, { message }));
      toast.error(err.message);
    }
  };

  const onInvalid = () => toast.error('Please correct the highlighted fields');
  const cancelHref = passport ? `/passports/${passport.id}` : '/passports';

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit, onInvalid)}
        noValidate
        className="flex flex-col gap-5 pb-24"
      >
        <Section
          id="general"
          title="General information"
          description="Identification and lifecycle of the battery."
        >
          <Grid>
            <TextField
              name="data.generalInformation.batteryIdentifier"
              label="Battery identifier"
              placeholder="BP-2024-011"
              mono
            />
            <TextField
              name="data.generalInformation.batteryModel.id"
              label="Model ID"
              placeholder="LM3-BAT-2024"
              mono
            />
            <TextField name="data.generalInformation.batteryModel.modelName" label="Model name" />
            <SelectField
              name="data.generalInformation.batteryCategory"
              label="Category"
              options={BATTERY_CATEGORIES}
            />
            <SelectField
              name="data.generalInformation.batteryStatus"
              label="Status"
              options={BATTERY_STATUSES}
            />
            <TextField
              name="data.generalInformation.batteryMass"
              label="Battery mass (kg)"
              type="number"
              step="any"
            />
            <TextField
              name="data.generalInformation.manufacturingDate"
              label="Manufacturing date"
              type="date"
            />
            <TextField name="data.generalInformation.manufacturingPlace" label="Manufacturing place" />
            <TextField
              name="data.generalInformation.warrantyPeriod"
              label="Warranty period (years)"
              placeholder="8"
            />
          </Grid>
        </Section>

        <Section id="manufacturer" title="Manufacturer information">
          <Grid>
            <TextField
              name="data.generalInformation.manufacturerInformation.manufacturerName"
              label="Manufacturer name"
            />
            <TextField
              name="data.generalInformation.manufacturerInformation.manufacturerIdentifier"
              label="Manufacturer identifier"
              mono
            />
          </Grid>
        </Section>

        <Section id="materials" title="Material composition">
          <div className="flex flex-col gap-6">
            <Grid>
              <TextField
                name="data.materialComposition.batteryChemistry"
                label="Battery chemistry"
                placeholder="LiFePO4"
              />
              <CriticalRawMaterialsField />
            </Grid>
            <HazardousSubstancesField />
          </div>
        </Section>

        <Section id="carbon" title="Carbon footprint">
          <Grid>
            <TextField
              name="data.carbonFootprint.totalCarbonFootprint"
              label="Total carbon footprint"
              type="number"
              step="any"
            />
            <TextField
              name="data.carbonFootprint.measurementUnit"
              label="Measurement unit"
              placeholder="kg CO2e"
            />
            <TextField
              name="data.carbonFootprint.methodology"
              label="Methodology"
              placeholder="Life Cycle Assessment (LCA)"
            />
          </Grid>
        </Section>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:left-[248px]">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3 sm:px-6 lg:px-10">
            <Button variant="secondary" asChild>
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <Button type="submit" loading={methods.formState.isSubmitting}>
              {passport ? 'Save changes' : 'Create passport'}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
