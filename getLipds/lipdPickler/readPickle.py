import pandas as pd
import sys

obj = pd.read_pickle(r'lipd.pkl')

obj2 = pd.DataFrame.from_dict(obj)

print(obj2)
