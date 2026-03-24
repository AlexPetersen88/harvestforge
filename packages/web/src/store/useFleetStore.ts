import { create } from "zustand";
import type { MachineWithPosition, Alert } from "@harvestforge/shared";

interface FleetState {
  machines: MachineWithPosition[];
  selectedMachineId: string | null;
  activeAlerts: Alert[];
  harvestMode: boolean;
  darkMode: boolean;

  setMachines: (machines: MachineWithPosition[]) => void;
  selectMachine: (id: string | null) => void;
  setAlerts: (alerts: Alert[]) => void;
  toggleHarvestMode: () => void;
  toggleDarkMode: () => void;
}

export const useFleetStore = create<FleetState>((set) => ({
  machines: [],
  selectedMachineId: null,
  activeAlerts: [],
  harvestMode: false,
  darkMode: true,

  setMachines: (machines) => set({ machines }),
  selectMachine: (id) => set({ selectedMachineId: id }),
  setAlerts: (alerts) => set({ activeAlerts: alerts }),
  toggleHarvestMode: () => set((s) => ({ harvestMode: !s.harvestMode })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}));
