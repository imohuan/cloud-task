import { ref, computed, watch } from "vue";
import { useRegistryStore } from "@/stores/useRegistryStore";

export interface TypeItem {
  id: string;
  label?: string;
  categoryId?: string;
  platformId?: string;
  platformName?: string;
  iconHtml?: string;
}

export interface ModelOption {
  id: string;
  name: string;
  apiId: string;
  value: string;
  desc?: string;
}

export interface RatioOption {
  id: string;
  label: string;
  w: number;
  h: number;
}

export interface ResolutionOption {
  id: string;
  label: string;
}

export interface NOption {
  id: string;
  label: string;
}

export interface CustomField {
  id: string;
  title: string;
  options: Array<{ id: string; label: string; name: string }>;
  defaultValue: string;
}

const RESERVED_ABILITIES = new Set(["model", "prompt", "image", "n", "size", "aspect_ratio"]);
const RESERVED_FIELD_NAMES = new Set(["model", "prompt", "image", "images"]);

function isPixelDimensionValue(value: string): boolean {
  return /^\d+x\d+$/.test(value);
}

function computeRatioBox(value: string): { rw: number; rh: number } {
  let rw = 14,
    rh = 14;

  const sep = value.includes("x") ? "x" : value.includes(":") ? ":" : null;
  if (!sep) return { rw, rh };
  const parts = value.split(sep);
  const w = Number(parts[0]);
  const h = Number(parts[1]);

  if (!w || !h) return { rw, rh };
  const ratio = w / h;
  if (ratio >= 2.3) {
    rw = 20;
    rh = 8;
  } else if (ratio >= 1.7) {
    rw = 18;
    rh = 10;
  } else if (ratio >= 1.4) {
    rw = 16;
    rh = 10;
  } else if (ratio > 1.05) {
    rw = 16;
    rh = 12;
  } else if (ratio >= 0.95) {
    rw = 14;
    rh = 14;
  } else if (ratio > 0.7) {
    rw = 12;
    rh = 16;
  } else if (ratio > 0.55) {
    rw = 10;
    rh = 18;
  } else {
    rw = 8;
    rh = 20;
  }
  return { rw, rh };
}

export function useGeneratorConfig() {
  const registryStore = useRegistryStore();

  // ── Type (platform + category) ──────────────────────────────────────────────
  const currentType = ref<TypeItem>({ id: "", label: "选择平台", categoryId: "" });

  function selectType(t: TypeItem) {
    currentType.value = t;
    currentModelValue.value = "";
  }

  // ── APIs for the selected platform + category ───────────────────────────────
  const categoryApis = computed(() => {
    if (!currentType.value.categoryId || !currentType.value.platformId) return [];
    return registryStore
      .getApisByCategory(currentType.value.categoryId)
      .filter((a: any) => a.platformId === currentType.value.platformId);
  });

  // ── Model ───────────────────────────────────────────────────────────────────
  const modelOptions = computed<ModelOption[]>(() => {
    const options: ModelOption[] = [];
    const seen = new Set<string>();
    for (const api of categoryApis.value) {
      const fields = (api.inputSchema as any)?.fields as any[] | undefined;
      const modelField = fields?.find((f: any) => f.name === "model");
      if (modelField?.enumValues) {
        for (const ev of modelField.enumValues) {
          const key = `${api.id}:${ev.value}`;
          if (!seen.has(key)) {
            seen.add(key);
            options.push({ id: key, name: ev.label, apiId: api.id, value: ev.value, desc: (api as any).description });
          }
        }
      }
    }
    return options;
  });

  const currentModelValue = ref<string>("");

  watch(
    modelOptions,
    (opts) => {
      if (currentModelValue.value && opts.find((o) => o.id === currentModelValue.value)) return;
      currentModelValue.value = opts[0]?.id ?? "";
    },
    { immediate: true },
  );


  const currentModelOption = computed<ModelOption | null>(
    () => modelOptions.value.find((m) => m.id === currentModelValue.value) ?? modelOptions.value[0] ?? null,
  );

  function selectModel(m: ModelOption) {
    currentModelValue.value = m.id;
  }

  // ── Current API (resolved from the selected model) ──────────────────────────
  const currentApi = computed<any>(() => {
    const modelOpt = currentModelOption.value;
    if (!modelOpt) return categoryApis.value[0] ?? null;
    return categoryApis.value.find((a: any) => a.id === modelOpt.apiId) ?? null;
  });

  // ── Ability → field map for the current API's inputSchema ──────────────────
  const abilityFieldMap = computed(() => {
    const map = new Map<string, Array<{ field: any; group?: string }>>();
    const fields: any[] = (currentApi.value?.inputSchema as any)?.fields ?? [];
    for (const field of fields) {
      for (const ability of (field.abilities ?? []) as any[]) {
        const list = map.get(ability.name) ?? [];
        list.push({ field, group: ability.group });
        map.set(ability.name, list);
      }
    }
    return map;
  });

  // ── Dimension fields → RatioDropdown ───────────────────────────────────────
  // Ratio picker:
  //   • "size" ability with WxH pixel enumValues  → image size selector
  //   • "aspect_ratio" ability                    → video ratio selector (fallback)
  const ratioSourceField = computed(() => {
    const sizeEntries = abilityFieldMap.value.get("size") ?? [];
    const pixelSizeField = sizeEntries.find(({ field }) =>
      field?.enumValues?.every((ev: any) => isPixelDimensionValue(ev.value)),
    )?.field;
    if (pixelSizeField) return pixelSizeField;
    return abilityFieldMap.value.get("aspect_ratio")?.[0]?.field ?? null;
  });

  // Resolution picker:
  //   • "size" ability with non-pixel values (720P, 1080P)  → quality selector
  //   • field named "resolution"                            → fallback
  const resolutionSourceField = computed(() => {
    const sizeEntries = abilityFieldMap.value.get("size") ?? [];
    const nonPixelSizeField = sizeEntries.find(
      ({ field }) => field?.enumValues?.length && !field.enumValues.every((ev: any) => isPixelDimensionValue(ev.value)),
    )?.field;
    if (nonPixelSizeField) return nonPixelSizeField;
    const fields: any[] = (currentApi.value?.inputSchema as any)?.fields ?? [];
    return fields.find((f: any) => f.name === "resolution") ?? null;
  });

  const hasDimension = computed(() => {
    const fields: any[] = (currentApi.value?.inputSchema as any)?.fields ?? [];
    return fields.some((f: any) => f.name === "width") && fields.some((f: any) => f.name === "height");
  });

  const ratioOptions = computed<RatioOption[]>(() => {
    const field = ratioSourceField.value;
    if (!field?.enumValues) return [];
    return (field.enumValues as any[]).map((ev) => {
      const { rw, rh } = computeRatioBox(ev.value);
      return { id: ev.value, label: ev.label.replace(/\s*\(.+?\)/, ""), w: rw, h: rh };
    });
  });

  const resolutionOptions = computed<ResolutionOption[]>(() => {
    const field = resolutionSourceField.value;
    if (!field?.enumValues) return [];
    return (field.enumValues as any[]).map((ev) => ({ id: ev.value, label: ev.label }));
  });

  const showDimension = computed(
    () => ratioOptions.value.length > 0 || resolutionOptions.value.length > 0 || hasDimension.value,
  );

  // ── N ───────────────────────────────────────────────────────────────────────
  const nField = computed(() => abilityFieldMap.value.get("n")?.[0]?.field ?? null);

  const nOptions = computed<NOption[]>(() => {
    if (!nField.value) return [];
    const max = nField.value.maxValue ?? 4;
    const unit = currentType.value.categoryId === "image" ? "张" : "个";
    return Array.from({ length: max }, (_, i) => ({ id: String(i + 1), label: `${i + 1}${unit}` }));
  });

  // ── Custom parameter fields (other ability fields with enumValues) ───────────
  // Excludes: model, prompt, image/images, n, size, aspect_ratio, dimension-grouped fields
  const customParameterFields = computed<CustomField[]>(() => {
    const fields: any[] = (currentApi.value?.inputSchema as any)?.fields ?? [];
    return fields
      .filter((f: any) => {
        if (RESERVED_FIELD_NAMES.has(f.name)) return false;
        if (!f.enumValues?.length) return false;
        const abilities: any[] = f.abilities ?? [];
        return !abilities.some((a: any) => RESERVED_ABILITIES.has(a.name) || a.group === "dimension");
      })
      .map((f: any) => ({
        id: f.name,
        title: f.description ?? "",
        options: (f.enumValues as any[]).map((ev) => ({ id: ev.value, label: ev.label, name: ev.label })),
        defaultValue: f.defaultValue !== undefined ? String(f.defaultValue) : "",
      }));
  });

  // ── Field values ────────────────────────────────────────────────────────────
  const fieldValues = ref<Record<string, string>>({ n: "1" });
  const customWidth = ref(2048);
  const customHeight = ref(2048);

  function setFieldValue(key: string, value: string) {
    fieldValues.value = { ...fieldValues.value, [key]: value };
  }

  function initFieldDefaults() {
    const updates: Record<string, string> = {};

    const firstRatio = ratioOptions.value[0];
    if (firstRatio && !ratioOptions.value.find((r) => r.id === fieldValues.value["ratio"])) {
      updates["ratio"] = firstRatio.id;
    }

    const firstRes = resolutionOptions.value[0];
    if (firstRes && !resolutionOptions.value.find((r) => r.id === fieldValues.value["resolution"])) {
      updates["resolution"] = firstRes.id;
    }

    if (!fieldValues.value["n"]) updates["n"] = "1";

    for (const field of customParameterFields.value) {
      const current = fieldValues.value[field.id];
      if (!current || !field.options.find((o) => o.id === current)) {
        updates[field.id] = field.defaultValue || field.options[0]?.id || "";
      }
    }

    if (Object.keys(updates).length > 0) {
      fieldValues.value = { ...fieldValues.value, ...updates };
    }
  }

  watch(currentApi, () => {
    initFieldDefaults();
  });

  // ── Current selections (derived from fieldValues) ───────────────────────────
  const currentRatio = computed<RatioOption | null>(
    () => ratioOptions.value.find((r) => r.id === fieldValues.value["ratio"]) ?? ratioOptions.value[0] ?? null,
  );

  const currentRes = computed<ResolutionOption | null>(() => {
    if (!resolutionOptions.value.length) return null;
    return (
      resolutionOptions.value.find((r) => r.id === fieldValues.value["resolution"]) ??
      resolutionOptions.value[0] ??
      null
    );
  });

  const currentN = computed<NOption | null>(
    () => nOptions.value.find((n) => n.id === fieldValues.value["n"]) ?? nOptions.value[0] ?? null,
  );

  // ── Ability flags ───────────────────────────────────────────────────────────
  const hasImageAbility = computed(() => abilityFieldMap.value.has("image"));

  // ── Image field config (maxImageLength / localUploadOnly) ──────────────────
  const imageFieldConfig = computed<{ maxImageLength: number; localUploadOnly: boolean }>(() => {
    const field = abilityFieldMap.value.get("image")?.[0]?.field;
    return {
      maxImageLength: field?.maxImageLength ?? 5,
      localUploadOnly: field?.localUploadOnly ?? false,
    };
  });

  // ── Selection actions ───────────────────────────────────────────────────────
  function selectRatio(ratio: RatioOption) {
    setFieldValue("ratio", ratio.id);
  }
  function selectResolution(res: ResolutionOption) {
    setFieldValue("resolution", res.id);
  }
  function updateWidth(v: number) {
    customWidth.value = v;
  }
  function updateHeight(v: number) {
    customHeight.value = v;
  }
  function selectN(n: NOption) {
    setFieldValue("n", n.id);
  }
  function selectCustomField(fieldName: string, item: { id: string }) {
    setFieldValue(fieldName, item.id);
  }

  // ── Config serialization ────────────────────────────────────────────────────
  function getConfig(): Record<string, any> {
    const config: Record<string, any> = {
      type: currentType.value.categoryId ?? "",
      model: currentModelOption.value?.value ?? currentModelOption.value?.id ?? "",
      apiId: currentApi.value?.id ?? "",
      platformId: currentType.value.platformId ?? "",
    };
    Object.entries(fieldValues.value).forEach(([k, v]) => {
      config[k] = k === "n" ? Number(v) : v;
    });
    if (hasDimension.value) {
      config.width = customWidth.value;
      config.height = customHeight.value;
    }
    return config;
  }

  function setConfig(config: any) {
    const targetApi = config.apiId ? registryStore.getApiById(config.apiId) : null;
    const fallbackApi = (registryStore.apis as any[]).find(
      (a) => a.categoryId === config.type && (!config.platformId || a.platformId === config.platformId),
    );
    const api = targetApi || fallbackApi;

    if (api) {
      const category = registryStore.categories.find((c: any) => c.id === api.categoryId);
      const platformId = String(api.platformId ?? "");
      const categoryId = String(api.categoryId ?? "");
      currentType.value = {
        id: `${platformId}:${categoryId}`,
        label: category?.name || "",
        categoryId,
        platformId,
      };
    }

    if (config.model) {
      const rawModel = String(config.model);
      if (config.apiId) {
        const compositeId = `${config.apiId}:${rawModel}`;
        const found = modelOptions.value.find((o) => o.id === compositeId);
        currentModelValue.value = found ? compositeId : (modelOptions.value.find((o) => o.value === rawModel)?.id ?? compositeId);
      } else {
        const found = modelOptions.value.find((o) => o.value === rawModel);
        currentModelValue.value = found?.id ?? rawModel;
      }
    }
    if (config.ratio) setFieldValue("ratio", String(config.ratio));
    if (config.resolution) setFieldValue("resolution", String(config.resolution));
    if (config.n !== undefined) setFieldValue("n", String(config.n));
    if (config.width) updateWidth(config.width);
    if (config.height) updateHeight(config.height);

    const reservedKeys = new Set([
      "type",
      "model",
      "ratio",
      "resolution",
      "apiId",
      "platformId",
      "n",
      "width",
      "height",
    ]);
    Object.entries(config).forEach(([key, value]) => {
      if (reservedKeys.has(key) || value === undefined || value === null) return;
      setFieldValue(key, String(value));
    });
  }

  return {
    currentType,
    selectType,
    categoryApis,
    modelOptions,
    currentModelValue,
    currentModelOption,
    selectModel,
    currentApi,
    abilityFieldMap,
    ratioOptions,
    resolutionOptions,
    hasDimension,
    showDimension,
    currentRatio,
    currentRes,
    customWidth,
    customHeight,
    selectRatio,
    selectResolution,
    updateWidth,
    updateHeight,
    nOptions,
    currentN,
    selectN,
    customParameterFields,
    fieldValues,
    selectCustomField,
    hasImageAbility,
    imageFieldConfig,
    getConfig,
    setConfig,
  };
}
