export const designFields = [
  ['speed', 'Скорость'], ['armor', 'Броня'], ['attack', 'Атака'], ['vision', 'Обзор'],
  ['cargo', 'Груз'], ['communication', 'Связь'], ['cpu', 'CPU'], ['energy', 'Энергия'],
]
export const emptyDesign = Object.fromEntries(designFields.map(([key]) => [key, 0]))

export const botExample = `def on_tick():
    cargo = getCargo()
    if cargo.total >= cargo.capacity:
        memory["target"] = null
        base = getBase()
        if base:
            if distance(base) > 35:
                moveTo(base)
            elif getEnergy() >= 1:
                unload(base)
    elif memory["target"]:
        target = memory["target"]
        if distance(target) > 25:
            moveTo(target)
        elif getEnergy() >= 2:
            mine(target)
            memory["target"] = null
    else:
        if getEnergy() >= 4:
            objects = scan()
            index = memory["scan_index"] or 0
            if index >= len(objects):
                index = 0
            if len(objects) > 0:
                object = objects[index]
                memory["scan_index"] = index + 1
                if object.type == "resource":
                    memory["target"] = object`

export const controllerExample = `def on_tick():
    if count("default") < 3:
        if canSpawn("default"):
            spawn("default", {"group": "workers"})`
