import copy
import unittest
from prepare import prepare


def examples():
    return [{"groupId": f"g{i}", "reviewed": True, "reviewer": "test-editor", "rights": "test fixture", "source": "editorial", "containsPersonalData": False,
             "messages": [{"role": "user", "content": [{"text": f"Test scenario {i}"}]}, {"role": "assistant", "content": [{"text": "Fixture answer"}]}]} for i in range(20)]


class PreparationTests(unittest.TestCase):
    def test_unreviewed_and_private_data_rejected(self):
        for key, value in [("reviewed", False), ("source", "user_conversation"), ("containsPersonalData", True)]:
            data = examples()
            data[0][key] = value
            with self.assertRaises(ValueError):
                prepare(data, minimum=10)

    def test_duplicate_and_small_dataset_rejected(self):
        data = examples()
        with self.assertRaises(ValueError):
            prepare(data)
        data.append(copy.deepcopy(data[0]))
        with self.assertRaises(ValueError):
            prepare(data, minimum=10)

    def test_reproducible_grouped_split(self):
        data = examples()
        extra = copy.deepcopy(data[0])
        extra["messages"][0]["content"][0]["text"] += " follow-up"
        data.append(extra)
        a = prepare(data, minimum=10)
        self.assertEqual(a, prepare(data, minimum=10))
        locations = [split for split, rows in a.items() if any(r["messages"][0]["content"][0]["text"].startswith("Test scenario 0") for r in rows)]
        self.assertEqual(len(locations), 1)
        self.assertEqual(sum(map(len, a.values())), 21)


if __name__ == '__main__':
    unittest.main()
